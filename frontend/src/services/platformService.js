import api from './api';

const data = (promise) => promise.then((response) => response.data);

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Stored images are either absolute URLs or /uploads paths on the API server. */
export const mediaUrl = (url) => (url && url.startsWith('/uploads') ? `${API_BASE}${url}` : url || '');

export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  err.response?.data?.message || fallback;

export const account = {
  me: () => data(api.get('/auth/me')),
  setEmail: (email, password) => data(api.put('/auth/email', { email, password })),
  resendVerification: () => data(api.post('/auth/resend-verification')),
  verifyEmail: (token) => data(api.post('/auth/verify-email', { token })),
  forgotPassword: (email) => data(api.post('/auth/forgot-password', { email })),
  resetPassword: (token, password) => data(api.post('/auth/reset-password', { token, password })),
  changePassword: (currentPassword, newPassword) => data(api.put('/auth/password', { currentPassword, newPassword })),
  oauthProviders: () => data(api.get('/auth/oauth/providers')),
  oauthStart: (provider) => data(api.get(`/auth/oauth/${provider}/start`)),
  oauthCallback: (provider, code, state) => data(api.post(`/auth/oauth/${provider}/callback`, { code, state })),
  twoFactorSetup: () => data(api.post('/auth/2fa/setup')),
  twoFactorEnable: (code) => data(api.post('/auth/2fa/enable', { code })),
  twoFactorDisable: (code) => data(api.post('/auth/2fa/disable', { code })),
  twoFactorVerify: (challenge, code) => data(api.post('/auth/2fa/verify', { challenge, code })),
  updatePreferences: (fields) => data(api.put('/users/preferences', fields)),
  muted: () => data(api.get('/users/muted')),
  toggleMuteUser: (username) => data(api.post(`/users/mute/${encodeURIComponent(username)}`)),
  toggleMuteTag: (tag) => data(api.post(`/users/tags/${encodeURIComponent(tag)}/mute`)),
  toggleFollowTag: (tag) => data(api.post(`/users/tags/${encodeURIComponent(tag)}/follow`)),
  downloads: () => data(api.get('/users/me/downloads')),
  clearDownloads: () => data(api.delete('/users/me/downloads')),
  removeDownload: (id) => data(api.delete(`/users/me/downloads/${id}`)),
  exportData: () => data(api.get('/users/me/export')),
  deleteAccount: (body) => data(api.delete('/users/me', { data: body }))
};

export const notifications = {
  list: () => data(api.get('/notifications')),
  unreadCount: () => data(api.get('/notifications/unread-count')),
  markRead: (ids) => data(api.post('/notifications/read', ids ? { ids } : {}))
};

export const comments = {
  list: (wallpaperId) => data(api.get(`/wallpapers/${wallpaperId}/comments`)),
  create: (wallpaperId, text, parentId) => data(api.post(`/wallpapers/${wallpaperId}/comments`, { text, parentId })),
  remove: (id) => data(api.delete(`/comments/${id}`))
};

export const moderation = {
  report: (targetType, targetId, reason, details) => data(api.post('/reports', { targetType, targetId, reason, details })),
  stats: () => data(api.get('/admin/stats')),
  reports: (status) => data(api.get('/admin/reports', { params: { status } })),
  resolve: (id, action) => data(api.put(`/admin/reports/${id}`, { action })),
  users: (q) => data(api.get('/admin/users', { params: { q } })),
  setSuspended: (id, suspended) => data(api.put(`/admin/users/${id}/status`, { suspended })),
  setRole: (id, role) => data(api.put(`/admin/users/${id}/role`, { role })),
  setVerified: (id, isVerified) => data(api.put(`/admin/users/${id}/verified`, { isVerified }))
};

export const community = {
  challenges: () => data(api.get('/challenges')),
  challenge: (id) => data(api.get(`/challenges/${id}`)),
  createChallenge: (fields) => data(api.post('/challenges', fields)),
  submit: (id, wallpaperId) => data(api.post(`/challenges/${id}/submit`, { wallpaperId })),
  vote: (id, submissionId) => data(api.post(`/challenges/${id}/vote`, { submissionId })),
  leaderboard: (period) => data(api.get('/users/leaderboard', { params: { period } }))
};

export const discovery = {
  list: (params) => data(api.get('/wallpapers', { params })),
  tags: (q, limit = 8) => data(api.get('/wallpapers/tags', { params: { q, limit } })),
  forYou: (page = 1) => data(api.get('/wallpapers/for-you', { params: { page, limit: 24 } })),
  savedSearches: () => data(api.get('/saved-searches')),
  saveSearch: (fields) => data(api.post('/saved-searches', fields)),
  updateSavedSearch: (id, fields) => data(api.put(`/saved-searches/${id}`, fields)),
  deleteSavedSearch: (id) => data(api.delete(`/saved-searches/${id}`)),
  aiStatus: () => data(api.get('/ai/status')),
  aiSearch: (query) => data(api.post('/ai/search', { query }))
};

export const studio = {
  mine: (status) => data(api.get('/wallpapers/mine', { params: status ? { status } : {} })),
  setPublish: (id, status, scheduledAt) => data(api.put(`/wallpapers/${id}/publish`, { status, scheduledAt })),
  analytics: (id, days) => data(api.get(`/wallpapers/${id}/analytics`, { params: { days } })),
  addVariant: (id, fields) => data(api.post(`/wallpapers/${id}/variants`, fields)),
  removeVariant: (id, variantId) => data(api.delete(`/wallpapers/${id}/variants/${variantId}`)),
  suggest: (file) => {
    const form = new FormData();
    form.append('file', file);
    return data(api.post('/ai/suggest', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  }
};

export const payments = {
  connectStatus: () => data(api.get('/payments/connect')),
  onboard: () => data(api.post('/payments/connect/onboard')),
  refresh: () => data(api.post('/payments/connect/refresh')),
  dashboard: () => data(api.post('/payments/connect/dashboard')),
  tip: (creator, amountCents) => data(api.post('/payments/tips', { creator, amountCents })),
  earnings: () => data(api.get('/payments/earnings'))
};

export const packs = {
  list: () => data(api.get('/packs')),
  mine: () => data(api.get('/packs/mine')),
  purchased: () => data(api.get('/packs/purchased')),
  get: (id) => data(api.get(`/packs/${id}`)),
  create: (fields) => data(api.post('/packs', fields)),
  publish: (id) => data(api.put(`/packs/${id}/publish`)),
  unpublish: (id) => data(api.put(`/packs/${id}/unpublish`)),
  remove: (id) => data(api.delete(`/packs/${id}`)),
  checkout: (id) => data(api.post(`/packs/${id}/checkout`)),
  downloadLink: (id) => data(api.post(`/packs/${id}/download-link`))
};

export const developer = {
  keys: () => data(api.get('/developer/keys')),
  createKey: (name) => data(api.post('/developer/keys', { name })),
  revokeKey: (id) => data(api.delete(`/developer/keys/${id}`))
};

export const collections = {
  setCover: (id, wallpaperId) => data(api.put(`/playlists/${id}/cover`, { wallpaperId })),
  reorder: (id, wallpaperIds) => data(api.put(`/playlists/${id}/order`, { wallpaperIds })),
  setTimeSlots: (id, timeSlots) => data(api.put(`/playlists/${id}/time-slots`, { timeSlots })),
  current: (id, hour) => data(api.get(`/playlists/${id}/current`, { params: { hour } })),
  downloadZip: (id) => api.get(`/playlists/${id}/download`, { responseType: 'blob' })
};

/** Save a Blob as a file. */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const saveText = (text, filename, type = 'text/plain') => saveBlob(new Blob([text], { type }), filename);
