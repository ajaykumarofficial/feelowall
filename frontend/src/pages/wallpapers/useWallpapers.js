import { useState, useEffect, useCallback, useRef } from 'react';
import wallpaperService from '../../services/wallpaperService';
import { extractColors } from '../../utils/extractColors';

const PAGE_SIZE = 12;

export const useWallpapers = (showToast) => {
  const [wallpapers, setWallpapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [colorQuery, setColorQuery] = useState(null);
  const [lightboxWp, setLightboxWp] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editingWp, setEditingWp] = useState(null);
  const [featuredWallpapers, setFeaturedWallpapers] = useState([]);

  const fetchFeatured = useCallback(async () => {
    try {
      const data = await wallpaperService.getFeaturedWallpapers();
      setFeaturedWallpapers(data || []);
    } catch (error) {
      console.error('Failed to fetch featured wallpapers:', error);
    }
  }, []);

  useEffect(() => {
    fetchFeatured();
  }, [fetchFeatured]);

  // Fetch page 1 (reset) whenever filters/category/sort change
  const fetchWallpapers = useCallback(async (cat = category, search = searchQuery, sort = sortBy, col = colorQuery) => {
    setLoading(true);
    setPage(1);
    try {
      const data = await wallpaperService.getWallpapers(cat, search, sort, 1, PAGE_SIZE, col);
      setWallpapers(data.wallpapers);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error(error);
      showToast('Could not load wallpapers. Is backend server online?', 'error');
    } finally {
      setLoading(false);
    }
  }, [category, searchQuery, sortBy, colorQuery, showToast]);

  // Load next page (append)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await wallpaperService.getWallpapers(category, searchQuery, sortBy, nextPage, PAGE_SIZE, colorQuery);
      setWallpapers(prev => [...prev, ...data.wallpapers]);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (error) {
      console.error(error);
      showToast('Failed to load more wallpapers.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [category, searchQuery, sortBy, page, hasMore, loadingMore, colorQuery, showToast]);

  useEffect(() => {
    fetchWallpapers();
  }, [category, searchQuery, sortBy, colorQuery]);

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
  };

  const handleSearchSubmit = (query) => {
    setSearchQuery(query);
  };

  const handleResetFilters = () => {
    setCategory('All');
    setSearchQuery('');
  };

  const handleUpload = async (title, uploadCat, file, videoFile = null) => {
    setUploadLoading(true);
    try {
      // Extract dominant colors from the image file on the client side
      const hexToRgbLocal = (hexStr) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
      };

      const extractedColors = await new Promise((resolve) => {
        const tempUrl = URL.createObjectURL(file);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const rawColors = extractColors(img, 5);
          URL.revokeObjectURL(tempUrl);
          resolve(rawColors.map(hex => ({
            hex,
            ...hexToRgbLocal(hex)
          })));
        };
        img.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          resolve([]);
        };
        img.src = tempUrl;
      });

      // Step 1: Upload the cover image file to Cloudinary / storage first
      const uploadResult = await wallpaperService.uploadFile(file);
      const { url, publicId } = uploadResult;

      // Step 1.5: Upload video file if provided
      let videoUrl = '';
      if (videoFile) {
        showToast('Uploading video loop...', 'info');
        const videoUploadResult = await wallpaperService.uploadFile(videoFile);
        videoUrl = videoUploadResult.url;
      }

      // Step 2: Save the wallpaper metadata to the database
      await wallpaperService.uploadWallpaper({
        title,
        category: uploadCat,
        imageUrl: url,
        filename: publicId,
        colors: extractedColors,
        isLive: !!videoFile,
        videoUrl: videoUrl
      });

      showToast('Wallpaper uploaded successfully!', 'success');
      setIsUploadOpen(false);
      fetchWallpapers(); // reload wallpaper grid
      return { success: true };
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Upload failed.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    } finally {
      setUploadLoading(false);
    }
  };

  const handleUpdate = async (id, title, updateCat) => {
    setUploadLoading(true);
    try {
      await wallpaperService.updateWallpaper(id, title, updateCat);
      showToast('Wallpaper updated successfully!', 'success');
      setIsUploadOpen(false);
      setEditingWp(null);
      fetchWallpapers();
      return { success: true };
    } catch (error) {
      const msg = error.response?.data?.message || 'Update failed.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this wallpaper?')) return;
    try {
      await wallpaperService.deleteWallpaper(id);
      showToast('Wallpaper deleted successfully!', 'success');
      fetchWallpapers();
    } catch (error) {
      const msg = error.response?.data?.message || 'Delete failed.';
      showToast(msg, 'error');
    }
  };

  const handleLike = async (id, currentUser) => {
    if (!currentUser) {
      showToast('Please sign in to like wallpapers.', 'error');
      return null;
    }
    try {
      const res = await wallpaperService.likeWallpaper(id);
      
      // Update local state wallpapers likes array and likesCount
      setWallpapers(prev => prev.map(item => {
        if (item._id === id || item.id === id) {
          const likesList = [...(item.likes || [])];
          const userIdx = likesList.indexOf(currentUser.id);
          if (userIdx > -1) {
            likesList.splice(userIdx, 1);
          } else {
            likesList.push(currentUser.id);
          }
          return { 
            ...item, 
            likes: likesList,
            likesCount: res.likesCount 
          };
        }
        return item;
      }));

      // Update lightbox state if it's currently open
      setLightboxWp(prev => {
        if (prev && (prev._id === id || prev.id === id)) {
          const likesList = [...(prev.likes || [])];
          const userIdx = likesList.indexOf(currentUser.id);
          if (userIdx > -1) {
            likesList.splice(userIdx, 1);
          } else {
            likesList.push(currentUser.id);
          }
          return { 
            ...prev, 
            likes: likesList,
            likesCount: res.likesCount 
          };
        }
        return prev;
      });

      showToast(res.message, 'success');
      return res;
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to toggle like.';
      showToast(msg, 'error');
      return null;
    }
  };

  const openLightbox = async (wp) => {
    setLightboxWp(wp);
    try {
      // Increment views count in background
      await wallpaperService.incrementViewCount(wp._id || wp.id);
      
      // Update state views count immediately
      setWallpapers(prev => prev.map(item => {
        if (item._id === wp._id || item.id === wp.id) {
          return { ...item, viewsCount: (item.viewsCount || 0) + 1 };
        }
        return item;
      }));
      setLightboxWp(prev => prev ? { ...prev, viewsCount: (prev.viewsCount || 0) + 1 } : null);
    } catch (err) {
      console.error('Increment view error:', err);
    }
  };

  const handleDownloadIncrement = async (id) => {
    try {
      await wallpaperService.incrementDownloadCount(id);
      setWallpapers(prev => prev.map(item => {
        if (item._id === id || item.id === id) {
          return { ...item, downloadsCount: (item.downloadsCount || 0) + 1 };
        }
        return item;
      }));
      setLightboxWp(prev => {
        if (prev && (prev._id === id || prev.id === id)) {
          return { ...prev, downloadsCount: (prev.downloadsCount || 0) + 1 };
        }
        return prev;
      });
    } catch (err) {
      console.error('Increment download error:', err);
    }
  };

  const handleToggleFeature = async (id) => {
    try {
      const res = await wallpaperService.toggleFeatureWallpaper(id);
      showToast(res.message, 'success');
      fetchFeatured();
      setWallpapers(prev => prev.map(item => {
        if (item._id === id || item.id === id) {
          return { ...item, isFeatured: res.isFeatured };
        }
        return item;
      }));
      setLightboxWp(prev => {
        if (prev && (prev._id === id || prev.id === id)) {
          return { ...prev, isFeatured: res.isFeatured };
        }
        return prev;
      });
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to toggle featured status.';
      showToast(msg, 'error');
    }
  };

  const closeLightbox = () => setLightboxWp(null);

  const openUpload = () => {
    setEditingWp(null);
    setIsUploadOpen(true);
  };
  
  const openEdit = (wp) => {
    setEditingWp(wp);
    setIsUploadOpen(true);
  };

  const closeUpload = () => {
    setIsUploadOpen(false);
    setEditingWp(null);
  };

  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  const openBulkUpload = () => {
    setIsBulkUploadOpen(true);
  };

  const closeBulkUpload = () => {
    setIsBulkUploadOpen(false);
  };

  const handleBulkUpload = async (item) => {
    try {
      const hexToRgbLocal = (hexStr) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 128, g: 128, b: 128 };
      };

      const extractedColors = await new Promise((resolve) => {
        const tempUrl = URL.createObjectURL(item.file);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const rawColors = extractColors(img, 5);
          URL.revokeObjectURL(tempUrl);
          resolve(rawColors.map(hex => ({
            hex,
            ...hexToRgbLocal(hex)
          })));
        };
        img.onerror = () => {
          URL.revokeObjectURL(tempUrl);
          resolve([]);
        };
        img.src = tempUrl;
      });

      const uploadResult = await wallpaperService.uploadFile(item.file);
      const { url, publicId } = uploadResult;

      await wallpaperService.uploadWallpaper({
        title: item.title,
        category: item.category,
        imageUrl: url,
        filename: publicId,
        colors: extractedColors,
        tags: item.tags,
        isLive: false,
        videoUrl: ''
      });

      fetchWallpapers();
      return { success: true };
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Upload failed.';
      return { success: false, message: msg };
    }
  };

  return {
    wallpapers,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    category,
    searchQuery,
    sortBy,
    setSortBy,
    colorQuery,
    setColorQuery,
    lightboxWp,
    isUploadOpen,
    uploadLoading,
    editingWp,
    featuredWallpapers,
    isBulkUploadOpen,
    openBulkUpload,
    closeBulkUpload,
    handleBulkUpload,
    fetchWallpapers,
    handleCategoryChange,
    handleSearchSubmit,
    handleResetFilters,
    handleUpload,
    handleUpdate,
    handleDelete,
    handleLike,
    handleDownloadIncrement,
    handleToggleFeature,
    openLightbox,
    closeLightbox,
    openUpload,
    openEdit,
    closeUpload
  };
};

export default useWallpapers;
