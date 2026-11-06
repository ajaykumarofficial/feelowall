import api from './api';

export const createPlaylist = async (name, description, isPublic) => {
  const response = await api.post('/playlists', { name, description, isPublic });
  return response.data;
};

export const getPlaylists = async (creatorId = null) => {
  const params = {};
  if (creatorId) {
    params.creatorId = creatorId;
  }
  const response = await api.get('/playlists', { params });
  return response.data;
};

export const getPlaylistById = async (id) => {
  const response = await api.get(`/playlists/${id}`);
  return response.data;
};

export const updatePlaylist = async (id, data) => {
  const response = await api.put(`/playlists/${id}`, data);
  return response.data;
};

export const deletePlaylist = async (id) => {
  const response = await api.delete(`/playlists/${id}`);
  return response.data;
};

export const addWallpaperToPlaylist = async (playlistId, wallpaperId) => {
  const response = await api.post(`/playlists/${playlistId}/wallpapers`, { wallpaperId });
  return response.data;
};

export const removeWallpaperFromPlaylist = async (playlistId, wallpaperId) => {
  const response = await api.delete(`/playlists/${playlistId}/wallpapers/${wallpaperId}`);
  return response.data;
};

export const addContributor = async (playlistId, username) => {
  const response = await api.post(`/playlists/${playlistId}/contributors`, { username });
  return response.data;
};

export const removeContributor = async (playlistId, userId) => {
  const response = await api.delete(`/playlists/${playlistId}/contributors/${userId}`);
  return response.data;
};

export default {
  createPlaylist,
  getPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addWallpaperToPlaylist,
  removeWallpaperFromPlaylist,
  addContributor,
  removeContributor
};
