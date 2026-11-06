const { User } = require('../../../databaseModels');
const { hashPassword, comparePassword } = require('../../../helper/bcrypt');
const { signToken } = require('../../../helper/jwt');

/**
 * Handle user registration
 */
const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    const passwordHash = await hashPassword(password);

    const newUser = new User({
      username,
      passwordHash
    });
    await newUser.save();

    res.status(201).json({ 
      message: 'User registered successfully.', 
      user: { id: newUser.id, username: newUser.username, avatarUrl: newUser.avatarUrl || '' } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};

/**
 * Handle user login
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const validPassword = await comparePassword(password, user.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid username or password.' });
    }

    const token = signToken({ id: user.id, username: user.username });

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl || '' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
};

/**
 * Handle OAuth authentication (Google, GitHub, Discord)
 */
const oauthLogin = async (req, res) => {
  try {
    const { provider, username, oauthId, avatarUrl } = req.body;
    if (!provider || !username || !oauthId) {
      return res.status(400).json({ message: 'Provider, username, and oauthId are required.' });
    }

    // Check if user already exists by oauthId + provider OR by username (case-insensitive)
    let user = await User.findOne({
      $or: [
        { oauthId, oauthProvider: provider },
        { username: { $regex: new RegExp('^' + username + '$', 'i') } }
      ]
    });

    if (!user) {
      // Create new user for social signup
      const passwordHash = await hashPassword(Math.random().toString(36).substring(2, 15));
      user = new User({
        username,
        passwordHash,
        avatarUrl: avatarUrl || '',
        oauthProvider: provider,
        oauthId: oauthId
      });
      await user.save();
    } else {
      // If user exists but doesn't have OAuth fields yet, update them
      let updated = false;
      if (!user.oauthId) {
        user.oauthId = oauthId;
        user.oauthProvider = provider;
        updated = true;
      }
      if (avatarUrl && !user.avatarUrl) {
        user.avatarUrl = avatarUrl;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    const token = signToken({ id: user.id, username: user.username });

    res.status(200).json({
      message: `${provider} login successful.`,
      token,
      user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl || '' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during OAuth authentication.', error: error.message });
  }
};

module.exports = {
  register,
  login,
  oauthLogin
};
