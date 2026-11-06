import api from './api';

export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

export const register = async (username, password) => {
  const response = await api.post('/auth/register', { username, password });
  return response.data;
};

export const oauthLogin = async (provider, username, oauthId, avatarUrl) => {
  const response = await api.post('/auth/oauth', { provider, username, oauthId, avatarUrl });
  return response.data;
};

export default {
  login,
  register,
  oauthLogin
};
