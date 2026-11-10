const crypto = require('crypto');
const { User } = require('../../../databaseModels');
const { hashPassword, comparePassword } = require('../../../helper/bcrypt');
const { signUserToken, signPurposeToken, verifyPurposeToken } = require('../../../helper/jwt');
const { exactCI, isEmail } = require('../../../helper/text');
const { selfView } = require('../../../helper/accountView');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const { issueAccountToken, consumeAccountToken } = require('../../../helper/accountTokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../../helper/mailer');
const oauth = require('../../../helper/oauth');
const totp = require('../../../helper/totp');
const { reportError } = require('../../../helper/logger');

const signedIn = (user, message) => ({ message, token: signUserToken(user), user: selfView(user) });

/** Finish a sign-in, stopping first to ask for a code if the account has two-factor turned on. */
const completeLogin = (res, user, message) => {
  if (user.status === 'suspended') {
    throw new HttpError(403, 'This account has been suspended.');
  }
  if (user.twoFactor?.enabled) {
    return res.status(200).json({
      message: 'Enter your authentication code.',
      twoFactorRequired: true,
      challenge: signPurposeToken({ id: user.id, tv: user.tokenVersion || 0 }, '2fa-login', '5m')
    });
  }
  return res.status(200).json(signedIn(user, message));
};

const sendVerification = async (user, email) => {
  try {
    const token = await issueAccountToken(user._id, 'verify-email', email);
    await sendVerificationEmail(email, token);
  } catch (err) {
    // The account is still usable, and the user can ask for the email again.
    reportError(err, { source: 'sendVerification' });
  }
};

/**
 * Handle user registration
 */
const register = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (email && !isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');

  if (await User.exists({ username: exactCI(username) })) {
    return res.status(400).json({ message: 'Username is already taken.' });
  }
  if (email && await User.exists({ email })) {
    return res.status(400).json({ message: 'That email address is already in use.' });
  }

  const newUser = new User({
    username,
    passwordHash: await hashPassword(password),
    ...(email ? { email } : {})
  });
  await newUser.save();
  if (email) await sendVerification(newUser, email);

  res.status(201).json({
    message: 'User registered successfully.',
    user: selfView(newUser)
  });
});

/**
 * Handle user login
 */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username: exactCI(username) });
  if (!user) {
    return res.status(400).json({ message: 'Invalid username or password.' });
  }

  const validPassword = await comparePassword(password, user.passwordHash);
  if (!validPassword) {
    return res.status(400).json({ message: 'Invalid username or password.' });
  }

  completeLogin(res, user, 'Login successful.');
});

// ─── OAuth ───────────────────────────────────────────────────

const listOAuthProviders = (req, res) => {
  res.status(200).json({ providers: oauth.configuredProviders() });
};

/**
 * Begin sign-in. `state` is signed, so the callback can prove the flow started
 * here; the browser also compares it to its stored copy to stop login CSRF.
 */
const startOAuth = (req, res) => {
  const provider = oauth.findProvider(req.params.provider);
  if (!provider || !oauth.isConfigured(provider)) {
    throw new HttpError(404, 'This sign-in provider is not available.');
  }
  const state = signPurposeToken({ provider, nonce: crypto.randomBytes(16).toString('hex') }, 'oauth-state', '10m');
  res.status(200).json({ url: oauth.buildAuthUrl(provider, state), state });
};

const uniqueUsername = async (requested) => {
  const base = String(requested || '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'user';
  const padded = base.length < 3 ? `${base}_user` : base;
  if (!await User.exists({ username: exactCI(padded) })) return padded;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${padded}_${crypto.randomBytes(2).toString('hex')}`;
    if (!await User.exists({ username: exactCI(candidate) })) return candidate;
  }
  return `${padded}_${crypto.randomBytes(6).toString('hex')}`;
};

/**
 * Finish sign-in. Identity comes from the provider, using a code exchanged by
 * this server. Accounts are matched on provider + provider ID only, so a matching
 * username or email can never take over an existing account.
 */
const oauthCallback = asyncHandler(async (req, res) => {
  const provider = oauth.findProvider(req.params.provider);
  const { code, state } = req.body;
  if (!provider || !oauth.isConfigured(provider)) {
    throw new HttpError(404, 'This sign-in provider is not available.');
  }
  if (typeof code !== 'string' || !code || typeof state !== 'string') {
    throw new HttpError(400, 'Missing sign-in details.');
  }

  let statePayload;
  try {
    statePayload = verifyPurposeToken(state, 'oauth-state');
  } catch {
    throw new HttpError(400, 'This sign-in link has expired. Please try again.');
  }
  if (statePayload.provider !== provider) throw new HttpError(400, 'Sign-in details did not match. Please try again.');

  const identity = await oauth.identify(provider, code);
  if (!identity?.id) throw new HttpError(401, 'The sign-in provider did not confirm your identity.');

  let user = await User.findOne({ oauthProvider: provider, oauthId: identity.id });
  if (!user) {
    const email = identity.email ? identity.email.toLowerCase() : null;
    const emailIsFree = email && !await User.exists({ email });
    user = new User({
      username: await uniqueUsername(identity.username),
      // Random and never revealed: these accounts sign in through the provider.
      passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
      avatarUrl: identity.avatarUrl || '',
      oauthProvider: provider,
      oauthId: identity.id,
      ...(emailIsFree ? { email, emailVerified: true } : {})
    });
    await user.save();
  }

  completeLogin(res, user, `${provider} login successful.`);
});

// ─── Email & recovery ────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ user: selfView(user) });
});

const setEmail = asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');

  const user = await User.findById(req.user.id);
  // Changing the recovery address is sensitive, so password accounts must confirm it's them.
  if (!user.oauthProvider) {
    const valid = typeof req.body.password === 'string' && await comparePassword(req.body.password, user.passwordHash);
    if (!valid) throw new HttpError(400, 'Your current password is incorrect.');
  }
  if (await User.exists({ email, _id: { $ne: user._id } })) {
    throw new HttpError(400, 'That email address is already in use.');
  }

  user.email = email;
  user.emailVerified = false;
  await user.save();
  await sendVerification(user, email);
  res.status(200).json({ message: 'Check your inbox to confirm this address.', user: selfView(user) });
});

const resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user.email) throw new HttpError(400, 'Add an email address first.');
  if (user.emailVerified) return res.status(200).json({ message: 'This address is already confirmed.' });
  await sendVerification(user, user.email);
  res.status(200).json({ message: 'Confirmation email sent.' });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const record = await consumeAccountToken(req.body.token, 'verify-email');
  if (!record) throw new HttpError(400, 'This confirmation link is invalid or has expired.');

  const user = await User.findById(record.userId);
  // Ignore links for an address the user has since changed.
  if (!user || user.email !== record.email) {
    throw new HttpError(400, 'This confirmation link is invalid or has expired.');
  }
  user.emailVerified = true;
  await user.save();
  res.status(200).json({ message: 'Email confirmed.' });
});

/** Always answers the same way, so this can't be used to find out who has an account. */
const forgotPassword = asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (isEmail(email)) {
    const user = await User.findOne({ email, emailVerified: true });
    if (user) {
      try {
        const token = await issueAccountToken(user._id, 'reset-password');
        await sendPasswordResetEmail(email, token);
      } catch (err) {
        reportError(err, { source: 'forgotPassword' });
      }
    }
  }
  res.status(200).json({ message: 'If that address belongs to a confirmed account, a reset link is on its way.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters long.');
  }
  const record = await consumeAccountToken(token, 'reset-password');
  if (!record) throw new HttpError(400, 'This reset link is invalid or has expired.');

  const user = await User.findById(record.userId);
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired.');

  user.passwordHash = await hashPassword(password);
  user.tokenVersion = (user.tokenVersion || 0) + 1; // Signs out every existing session
  await user.save();
  res.status(200).json({ message: 'Password updated. Please sign in.' });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters long.');
  }
  const user = await User.findById(req.user.id);
  const valid = typeof currentPassword === 'string' && await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new HttpError(400, 'Your current password is incorrect.');

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.status(200).json(signedIn(user, 'Password changed. Other devices have been signed out.'));
});

// ─── Two-factor authentication ───────────────────────────────

/** Accepts a time-based code, or uses up one recovery code. Saves the user if it matched. */
const checkSecondFactor = async (user, code) => {
  const secret = totp.decryptSecret(user.twoFactor.secret);
  const step = totp.verifyCode(secret, code, user.twoFactor.lastUsedStep || 0);
  if (step !== null) {
    user.twoFactor.lastUsedStep = step;
    await user.save();
    return true;
  }
  const hashed = totp.hashRecoveryCode(code);
  const index = (user.twoFactor.recoveryCodes || []).indexOf(hashed);
  if (index === -1) return false;
  user.twoFactor.recoveryCodes.splice(index, 1);
  await user.save();
  return true;
};

const setupTwoFactor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (user.twoFactor?.enabled) throw new HttpError(400, 'Two-factor authentication is already on.');
  const secret = totp.generateSecret();
  user.twoFactor.secret = totp.encryptSecret(secret);
  await user.save();
  res.status(200).json({ secret, otpauthUrl: totp.otpauthUrl(user.username, secret) });
});

const enableTwoFactor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (user.twoFactor?.enabled) throw new HttpError(400, 'Two-factor authentication is already on.');
  if (!user.twoFactor?.secret) throw new HttpError(400, 'Start two-factor setup first.');

  const step = totp.verifyCode(totp.decryptSecret(user.twoFactor.secret), req.body.code);
  if (step === null) throw new HttpError(400, 'That code is not correct. Please try again.');

  const recoveryCodes = totp.generateRecoveryCodes();
  user.twoFactor.enabled = true;
  user.twoFactor.lastUsedStep = step;
  user.twoFactor.recoveryCodes = recoveryCodes.map(totp.hashRecoveryCode);
  await user.save();
  res.status(200).json({ message: 'Two-factor authentication is on.', recoveryCodes, user: selfView(user) });
});

const disableTwoFactor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user.twoFactor?.enabled) throw new HttpError(400, 'Two-factor authentication is not on.');
  if (user.role !== 'user') throw new HttpError(403, 'Staff accounts must keep two-factor authentication on.');
  if (!await checkSecondFactor(user, req.body.code)) throw new HttpError(400, 'That code is not correct.');

  user.twoFactor = { enabled: false, secret: '', recoveryCodes: [], lastUsedStep: 0 };
  await user.save();
  res.status(200).json({ message: 'Two-factor authentication is off.', user: selfView(user) });
});

/** Second step of sign-in: exchange a challenge plus a code for a login token. */
const verifyTwoFactorLogin = asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = verifyPurposeToken(req.body.challenge, '2fa-login');
  } catch {
    throw new HttpError(401, 'Your sign-in attempt expired. Please start again.');
  }
  const user = await User.findById(payload.id);
  if (!user || (user.tokenVersion || 0) !== (payload.tv || 0) || !user.twoFactor?.enabled) {
    throw new HttpError(401, 'Your sign-in attempt expired. Please start again.');
  }
  if (user.status === 'suspended') throw new HttpError(403, 'This account has been suspended.');
  if (!await checkSecondFactor(user, req.body.code)) throw new HttpError(400, 'That code is not correct.');

  res.status(200).json(signedIn(user, 'Login successful.'));
});

module.exports = {
  register,
  login,
  listOAuthProviders,
  startOAuth,
  oauthCallback,
  getMe,
  setEmail,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactorLogin
};
