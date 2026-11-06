import api from './api';

export const getWallpapers = async (category, search, sortBy, page = 1, limit = 12, color = null) => {
  const params = {};
  if (category && category !== 'All') {
    params.category = category;
  }
  if (search) {
    params.search = search;
  }
  if (sortBy) {
    params.sortBy = sortBy;
  }
  if (color) {
    params.color = color;
  }
  params.page = page;
  params.limit = limit;

  const response = await api.get('/wallpapers', { params });
  if (Array.isArray(response.data)) {
    return {
      wallpapers: response.data,
      hasMore: false,
      total: response.data.length,
      page
    };
  }

  return {
    wallpapers: Array.isArray(response.data?.wallpapers) ? response.data.wallpapers : [],
    hasMore: Boolean(response.data?.hasMore),
    total: Number(response.data?.total || 0),
    page: Number(response.data?.page || page)
  };
};

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const uploadWallpaper = async (data) => {
  const response = await api.post('/wallpapers/upload', data);
  return response.data;
};

export const updateWallpaper = async (id, title, category) => {
  const response = await api.put(`/wallpapers/${id}`, { title, category });
  return response.data;
};

export const deleteWallpaper = async (id) => {
  const response = await api.delete(`/wallpapers/${id}`);
  return response.data;
};

export const likeWallpaper = async (id) => {
  const response = await api.post(`/wallpapers/${id}/like`);
  return response.data;
};

export const incrementViewCount = async (id) => {
  const response = await api.post(`/wallpapers/${id}/view`);
  return response.data;
};

export const incrementDownloadCount = async (id) => {
  const response = await api.post(`/wallpapers/${id}/download`);
  return response.data;
};

export const getFeaturedWallpapers = async () => {
  const response = await api.get('/wallpapers/featured');
  return response.data;
};

export const toggleFeatureWallpaper = async (id) => {
  const response = await api.put(`/wallpapers/${id}/feature`);
  return response.data;
};

export const getWallpaperById = async (id) => {
  const response = await api.get(`/wallpapers/${id}`);
  return response.data;
};

export const getSimilarWallpapers = async (id) => {
  const response = await api.get(`/wallpapers/${id}/similar`);
  return response.data;
};

export default {
  getWallpapers,
  getWallpaperById,
  uploadFile,
  uploadWallpaper,
  updateWallpaper,
  deleteWallpaper,
  likeWallpaper,
  incrementViewCount,
  incrementDownloadCount,
  getFeaturedWallpapers,
  toggleFeatureWallpaper,
  getSimilarWallpapers
};

