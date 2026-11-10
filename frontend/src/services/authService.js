import api from './api';

export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

export const register = async (username, password, email) => {
  const response = await api.post('/auth/register', { username, password, ...(email ? { email } : {}) });
  return response.data;
};

export default {
  login,
  register
};
