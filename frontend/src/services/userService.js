import api from './api';

export const toggleFollowUser = async (username) => {
  const response = await api.post(`/users/follow/${username}`);
  return response.data;
};

export const getFollowing = async () => {
  const response = await api.get('/users/following');
  return response.data;
};

export const getFeed = async (page = 1, limit = 12) => {
  const response = await api.get('/wallpapers/feed', {
    params: { page, limit }
  });
  return response.data;
};

export const updateAvatar = async (formData) => {
  const response = await api.put('/users/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await api.put('/users/profile', data);
  return response.data;
};

export const getCreatorProfile = async (username) => {
  const response = await api.get(`/users/profile/${username}`);
  return response.data;
};

export const getAnalytics = async (days = 7) => {
  const response = await api.get('/users/analytics', { params: { days } });
  return response.data;
};

export default {
  toggleFollowUser,
  getFollowing,
  getFeed,
  updateAvatar,
  updateProfile,
  getCreatorProfile,
  getAnalytics
};
