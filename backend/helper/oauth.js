const config = require('../config');
const { HttpError } = require('./asyncHandler');

const redirectUri = (provider) => `${config.FRONTEND_URL}/oauth/callback/${provider.toLowerCase()}`;

const jsonOrThrow = async (response, step) => {
  if (!response.ok) throw new HttpError(401, `Could not ${step} with the sign-in provider.`);
  return response.json();
};

const postForm = (url, body, headers = {}) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', ...headers },
  body: new URLSearchParams(body).toString()
});

/**
 * Each provider: how to start sign-in, and how to turn an authorization code into
 * an identity. Identity comes only from the provider, never from the browser.
 */
const PROVIDERS = {
  Google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
    async identify(code, { clientId, clientSecret }) {
      const tokens = await jsonOrThrow(await postForm('https://oauth2.googleapis.com/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri('Google'),
        grant_type: 'authorization_code'
      }), 'exchange the code');
      const profile = await jsonOrThrow(await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      }), 'read your profile');
      return {
        id: String(profile.sub),
        username: profile.name || (profile.email || '').split('@')[0],
        email: profile.email_verified ? profile.email : null,
        avatarUrl: profile.picture || ''
      };
    }
  },
  GitHub: {
    authUrl: 'https://github.com/login/oauth/authorize',
    scope: 'read:user user:email',
    async identify(code, { clientId, clientSecret }) {
      const tokens = await jsonOrThrow(await postForm('https://github.com/login/oauth/access_token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri('GitHub')
      }), 'exchange the code');
      if (!tokens.access_token) throw new HttpError(401, 'Could not exchange the code with the sign-in provider.');
      const headers = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'FeeloWall' };
      const profile = await jsonOrThrow(await fetch('https://api.github.com/user', { headers }), 'read your profile');
      let email = null;
      const emailResponse = await fetch('https://api.github.com/user/emails', { headers });
      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        email = emails.find((entry) => entry.primary && entry.verified)?.email || null;
      }
      return { id: String(profile.id), username: profile.login, email, avatarUrl: profile.avatar_url || '' };
    }
  },
  Discord: {
    authUrl: 'https://discord.com/oauth2/authorize',
    scope: 'identify email',
    async identify(code, { clientId, clientSecret }) {
      const tokens = await jsonOrThrow(await postForm('https://discord.com/api/oauth2/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri('Discord'),
        grant_type: 'authorization_code'
      }), 'exchange the code');
      const profile = await jsonOrThrow(await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      }), 'read your profile');
      return {
        id: String(profile.id),
        username: profile.global_name || profile.username,
        email: profile.verified ? profile.email : null,
        avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : ''
      };
    }
  }
};

const findProvider = (name) => Object.keys(PROVIDERS).find((key) => key.toLowerCase() === String(name).toLowerCase()) || null;

const isConfigured = (provider) => {
  const credentials = config.OAUTH[provider];
  return !!(credentials && credentials.clientId && credentials.clientSecret);
};

const configuredProviders = () => Object.keys(PROVIDERS).filter(isConfigured);

const buildAuthUrl = (provider, state) => {
  const params = new URLSearchParams({
    client_id: config.OAUTH[provider].clientId,
    redirect_uri: redirectUri(provider),
    response_type: 'code',
    scope: PROVIDERS[provider].scope,
    state
  });
  return `${PROVIDERS[provider].authUrl}?${params.toString()}`;
};

const identify = (provider, code) => PROVIDERS[provider].identify(code, config.OAUTH[provider]);

module.exports = { findProvider, isConfigured, configuredProviders, buildAuthUrl, identify };
