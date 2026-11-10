/** The account fields the signed-in user's own browser may see. */
const selfView = (user) => ({
  id: user.id || String(user._id),
  username: user.username,
  avatarUrl: user.avatarUrl || '',
  role: user.role || 'user',
  email: user.email || '',
  emailVerified: !!user.emailVerified,
  isVerified: !!user.isVerified,
  twoFactorEnabled: !!user.twoFactor?.enabled,
  hasPassword: !user.oauthProvider,
  oauthProvider: user.oauthProvider || null,
  showMature: !!user.showMature,
  followedTags: user.followedTags || [],
  mutedTags: user.mutedTags || []
});

module.exports = { selfView };
