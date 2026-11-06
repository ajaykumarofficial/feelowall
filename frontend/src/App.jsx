import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './pages/auth/useAuth';
import { useWallpapers } from './pages/wallpapers/useWallpapers';
import AuthModal from './pages/auth/AuthModal';
import AuthPage from './pages/auth/AuthPage';
import CreatorProfilePage from './pages/auth/CreatorProfilePage';
import WallpapersPage from './pages/wallpapers/WallpapersPage';
import WallpapersModal from './pages/wallpapers/WallpapersModal';
import BulkUploadModal from './pages/wallpapers/BulkUploadModal';
import SearchPage from './pages/wallpapers/SearchPage';
import WallpaperDetailPage from './pages/wallpapers/WallpaperDetailPage';
import ShaderArtCreator from './pages/wallpapers/ShaderArtCreator';
import SlideshowMode from './pages/wallpapers/SlideshowMode';
import Layout from './layout/Layout';
import PlaylistsPage from './pages/playlists/PlaylistsPage';
import PlaylistDetailPage from './pages/playlists/PlaylistDetailPage';
import AmbientEffects from './pages/wallpapers/AmbientEffects';
import playlistService from './services/playlistService';
import userService from './services/userService';
import { extractColors } from './utils/extractColors';
import { cropAndDownload, CROP_PRESETS } from './utils/cropImage';
import CropOverlay from './pages/wallpapers/CropOverlay';
import {
  User,
  X,
  Calendar,
  Tag,
  Download,
  Info,
  CheckCircle,
  AlertTriangle,
  Heart,
  Eye,
  Sliders,
  RotateCcw,
  Copy,
  Crop,
  FolderPlus,
  UserCheck,
  UserPlus,
  Sparkles,
  Smartphone,
  DownloadCloud,
  Search
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DEFAULT_ADJUSTMENTS = { blur: 0, brightness: 100, contrast: 100, grayscale: 0 };

const pageVariants = {
  initial: { opacity: 0, y: 15 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -15 }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.25
};

// Web Audio API synthesised click switch sound generator
const playClickSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // High frequency sharp transient "snap"
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(140, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.02);
    gain1.gain.setValueAtTime(0.06, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Deeper low-mid "thud" representing the physical spring lever snap
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(80, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.06);
    gain2.gain.setValueAtTime(0.05, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start();
    osc1.stop(ctx.currentTime + 0.03);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.07);
  } catch (err) {
    console.warn('Web Audio click sound failed:', err);
  }
};

const AppContent = () => {
  const { user } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();

  // Derive currentPage dynamically from route location pathname
  let currentPage = 'explore';
  if (location.pathname === '/search') currentPage = 'search';
  else if (location.pathname === '/profile') currentPage = 'profile';
  else if (location.pathname === '/feed') currentPage = 'feed';
  else if (location.pathname === '/playlists') currentPage = 'playlists';
  else if (location.pathname === '/generator') currentPage = 'generator';
  else if (location.pathname.startsWith('/playlists/')) currentPage = 'playlist-detail';
  else if (location.pathname.startsWith('/wallpaper/')) currentPage = 'wallpaper-detail';

  const setCurrentPage = (page) => {
    if (page === 'explore') navigate('/');
    else if (page === 'playlists') navigate('/playlists');
    else if (page === 'profile') navigate('/profile');
    else if (page === 'feed') navigate('/feed');
    else if (page === 'search') navigate('/search');
    else if (page === 'generator') navigate('/generator');
  };

  const [toasts, setToasts] = useState([]);
  const [slideshowWallpapers, setSlideshowWallpapers] = useState(null);

  // ─── Phase 5 States ───────────────────────────────────────
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);


  const [followingList, setFollowingList] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [ambientEffect, setAmbientEffect] = useState('none');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Creator Feed States
  const [feedWallpapers, setFeedWallpapers] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedPage, setFeedPage] = useState(1);
  const [feedHasMore, setFeedHasMore] = useState(false);

  // ─── Theme ────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('feelowall-theme') || 'dark');
  
  // Lamp pull-chain theme switch animation states
  const [lampAnimating, setLampAnimating] = useState(false);
  const [lampState, setLampState] = useState(theme === 'light');
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('feelowall-theme', theme);
  }, [theme]);

  // Sync light state with actual theme if toggled externally
  useEffect(() => {
    setLampState(theme === 'light');
  }, [theme]);

  const toggleTheme = () => {
    if (lampAnimating) return; // Prevent double trigger
    
    // Step 1: Slide down lamp
    setLampAnimating(true);
    setPulling(false);
    
    // Step 2: Pull the chain
    setTimeout(() => {
      setPulling(true);
      
      // Step 3: Switch theme (light goes on/off) in the middle of pull
      setTimeout(() => {
        // Trigger simulated physical switch click sound
        playClickSound();

        setTheme((t) => {
          const next = t === 'dark' ? 'light' : 'dark';
          setLampState(next === 'light');
          return next;
        });
        
        // Step 4: Release the chain
        setTimeout(() => {
          setPulling(false);
          
          // Step 5: Wait and slide lamp back up
          setTimeout(() => {
            setLampAnimating(false);
          }, 800);
        }, 200);
      }, 350);
    }, 500);
  };
  // Load follows & playlists when user logs in/out, navigates, or opens lightbox
  useEffect(() => {
    if (user) {
      userService.getFollowing()
        .then(setFollowingList)
        .catch(err => console.error(err));

      playlistService.getPlaylists(user.id || user._id)
        .then(setUserPlaylists)
        .catch(err => console.error(err));
    } else {
      setFollowingList([]);
      setUserPlaylists([]);
    }
  }, [user, currentPage]);

  // Toast helper
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  // Listen to PWA install prompt
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      showToast('FeeloWall is installable! Open profile avatar menu to install the app.', 'success');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [showToast]);

  // Feed fetcher
  const fetchFeed = useCallback(async (reset = false) => {
    if (!user) return;
    setFeedLoading(true);
    const nextPage = reset ? 1 : feedPage;
    try {
      const data = await userService.getFeed(nextPage, 12);
      if (reset) {
        setFeedWallpapers(data.wallpapers);
        setFeedPage(2);
      } else {
        setFeedWallpapers(prev => [...prev, ...data.wallpapers]);
        setFeedPage(nextPage + 1);
      }
      setFeedHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
      showToast('Could not load creator feed.', 'error');
    } finally {
      setFeedLoading(false);
    }
  }, [user, feedPage, showToast]);

  useEffect(() => {
    if (currentPage === 'feed') {
      fetchFeed(true);
    }
  }, [currentPage]);

  // Toggle follow uploader
  const handleToggleFollow = async (username) => {
    if (!user) {
      showToast('Please sign in to follow creators.', 'error');
      return;
    }
    try {
      const res = await userService.toggleFollowUser(username);
      showToast(res.message, 'success');
      const list = await userService.getFollowing();
      setFollowingList(list);
    } catch (err) {
      console.error(err);
      showToast('Could not toggle follow.', 'error');
    }
  };

  // Add wallpaper to collection selection
  const handleAddToPlaylist = async (playlistId) => {
    if (!playlistId) return;
    if (playlistId === 'new') {
      setCurrentPage('playlists');
      closeLightbox();
      showToast('Redirected to Collections. Create a playlist here!', 'info');
      return;
    }
    try {
      await playlistService.addWallpaperToPlaylist(playlistId, lightboxWp._id || lightboxWp.id);
      showToast('Wallpaper added to collection!', 'success');
      if (user) {
        const list = await playlistService.getPlaylists(user.id);
        setUserPlaylists(list);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add to collection.', 'error');
    }
  };

  // Trigger PWA install dialog
  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('FeeloWall installation started! Thanks for installing.', 'success');
      setDeferredPrompt(null);
    } else {
      showToast('Installation cancelled.', 'warning');
    }
  };

  // ─── Lightbox Adjustments ──────────────────────────────────
  const [adjustments, setAdjustments] = useState(DEFAULT_ADJUSTMENTS);

  // ─── Color Palette ─────────────────────────────────────────
  const [palette, setPalette] = useState([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const lightboxImgRef = useRef(null);

  // ─── Crop Picker ───────────────────────────────────────────
  const [cropMode, setCropMode] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState('original');
  const [cropDownloading, setCropDownloading] = useState(false);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isPlayLive, setIsPlayLive] = useState(true);

  const wpState = useWallpapers(showToast);
  const {
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
  } = wpState;

  const [lightboxCreator, setLightboxCreator] = useState(null);

  useEffect(() => {
    if (lightboxWp) {
      userService.getCreatorProfile(lightboxWp.uploadedBy)
        .then(setLightboxCreator)
        .catch(err => {
          console.error('Error fetching creator details for lightbox:', err);
          setLightboxCreator(null);
        });
    } else {
      setLightboxCreator(null);
    }
  }, [lightboxWp]);

  // Search input sync for Nav Bar
  const [navSearch, setNavSearch] = useState(searchQuery);
  useEffect(() => {
    setNavSearch(searchQuery);
  }, [searchQuery]);

  const handleNavSearchSubmit = (e) => {
    e.preventDefault();
    handleSearchSubmit(navSearch.trim());
    setCurrentPage('search');
  };

  const handleBrandClick = () => {
    handleResetFilters();
    setNavSearch('');
    setCurrentPage('explore');
  };

  // ─── Reset lightbox state on open ──────────────────────────
  const handleOpenLightbox = (wp) => {
    const wpId = typeof wp === 'string' ? wp : (wp?._id || wp?.id);
    if (wpId) {
      navigate(`/wallpaper/${wpId}`);
    }
  };

  const handleCropRatioChange = (presetValue) => {
    setSelectedCrop(presetValue);

    const preset = CROP_PRESETS.find((p) => p.value === presetValue);
    if (!preset || preset.value === 'original' || !lightboxImgRef.current) {
      setCropOffset({ x: 0, y: 0 });
      return;
    }

    const img = lightboxImgRef.current;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const targetRatio = preset.ratio;

    if (!naturalWidth || !naturalHeight) return;

    const imageRatio = naturalWidth / naturalHeight;
    let wCrop = 1.0;
    let hCrop = 1.0;

    if (imageRatio > targetRatio) {
      wCrop = targetRatio / imageRatio;
    } else {
      hCrop = imageRatio / targetRatio;
    }

    // Center position
    const defaultX = (1.0 - wCrop) / 2;
    const defaultY = (1.0 - hCrop) / 2;

    setCropOffset({ x: defaultX, y: defaultY });
  };

  // ─── Color extraction once image loads ─────────────────────
  const handleLightboxImageLoad = () => {
    if (!lightboxImgRef.current) return;
    setPaletteLoading(true);
    // Small timeout so browser finishes rendering
    setTimeout(() => {
      const colors = extractColors(lightboxImgRef.current, 6);
      setPalette(colors);
      setPaletteLoading(false);
    }, 200);
  };

  // Copy hex to clipboard
  const copyHex = (hex) => {
    navigator.clipboard.writeText(hex).then(
      () => showToast(`Copied ${hex} to clipboard!`, 'success'),
      () => showToast('Could not copy to clipboard.', 'error')
    );
  };

  const handleColorSearch = (hex) => {
    setColorQuery(hex);
    navigate('/');
    closeLightbox();
    showToast(`Filtering by color: ${hex}`, 'success');
  };

  // ─── Build CSS filter string from adjustments ───────────────
  const buildFilterString = (adj = adjustments) => {
    const { blur, brightness, contrast, grayscale } = adj;
    const parts = [];
    if (blur > 0) parts.push(`blur(${blur}px)`);
    if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
    if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
    if (grayscale > 0) parts.push(`grayscale(${grayscale}%)`);
    return parts.length ? parts.join(' ') : 'none';
  };

  const isAdjusted = JSON.stringify(adjustments) !== JSON.stringify(DEFAULT_ADJUSTMENTS);

  // ─── Original blob download ─────────────────────────────────
  const handleDownload = async (imageUrl, title, wpId) => {
    try {
      showToast('Downloading wallpaper...', 'info');
      if (wpId) handleDownloadIncrement(wpId);
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error('Failed to fetch image data');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Downloaded successfully!', 'success');
    } catch (error) {
      console.error('Direct download failed:', error);
      showToast('Direct download failed. Opening in a new tab...', 'warning');
      window.open(imageUrl, '_blank');
    }
  };

  // ─── Modified/cropped download ──────────────────────────────
  const handleSmartDownload = (imageUrl, title, wpId) => {
    const preset = CROP_PRESETS.find((p) => p.value === selectedCrop);
    const ratio = preset?.ratio || null;
    const fileName = `${title.toLowerCase().replace(/\s+/g, '-')}-${selectedCrop}`;

    cropAndDownload(
      imageUrl,
      fileName,
      ratio,
      isAdjusted ? adjustments : null,
      () => {
        setCropDownloading(true);
        showToast('Processing image...', 'info');
        if (wpId) handleDownloadIncrement(wpId);
      },
      () => {
        setCropDownloading(false);
        showToast('Modified image downloaded!', 'success');
      },
      (err) => {
        setCropDownloading(false);
        showToast(`Download failed: ${err}`, 'error');
      },
      preset?.value !== 'original' ? cropOffset : null
    );
  };

  // ─── Derive lightbox image URL ──────────────────────────────
  const getLightboxUrl = (wp) =>
    wp?.imageUrl?.startsWith('/uploads') ? `${BACKEND_URL}${wp.imageUrl}` : wp?.imageUrl;

  const getLightboxVideoUrl = (wp) =>
    wp?.videoUrl?.startsWith('/uploads') ? `${BACKEND_URL}${wp.videoUrl}` : wp?.videoUrl;

  return (
    <Layout
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      navSearch={navSearch}
      setNavSearch={setNavSearch}
      handleNavSearchSubmit={handleNavSearchSubmit}
      handleBrandClick={handleBrandClick}
      theme={theme}
      toggleTheme={toggleTheme}
      openUpload={openUpload}
      openBulkUpload={openBulkUpload}
      showToast={showToast}
      deferredPrompt={deferredPrompt}
      onInstallApp={handleInstallApp}
    >
      {/* ACTIVE PAGE */}
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <WallpapersPage
            wallpapers={wallpapers}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            loadMore={loadMore}
            category={category}
            searchQuery={searchQuery}
            currentUser={user}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onLike={handleLike}
            onCategoryChange={(cat) => {
              handleCategoryChange(cat);
              navigate('/');
            }}
            onSearchSubmit={(query) => {
              handleSearchSubmit(query);
              navigate('/search');
            }}
            onResetFilters={handleResetFilters}
            onZoom={handleOpenLightbox}
            onEdit={openEdit}
            onDelete={handleDelete}
            colorQuery={colorQuery}
            onColorChange={setColorQuery}
            featuredWallpapers={featuredWallpapers}
            onToggleFeature={handleToggleFeature}
            onStartSlideshow={setSlideshowWallpapers}
          />
        } />
        <Route path="/explore" element={<Navigate to="/" replace />} />
        <Route path="/search" element={
          <SearchPage
            wallpapers={wallpapers}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            loadMore={loadMore}
            searchQuery={searchQuery}
            category={category}
            currentUser={user}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onLike={handleLike}
            onSearchSubmit={(query) => {
              handleSearchSubmit(query);
              navigate('/search');
            }}
            onResetFilters={handleResetFilters}
            onZoom={handleOpenLightbox}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        } />
        <Route path="/profile" element={
          <AuthPage
            wallpapers={wallpapers}
            onEdit={openEdit}
            onDelete={handleDelete}
            onZoom={handleOpenLightbox}
            onLike={handleLike}
            showToast={showToast}
          />
        } />
        <Route path="/creator/:username" element={
          <CreatorProfilePage
            onZoom={handleOpenLightbox}
            onLike={handleLike}
            showToast={showToast}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        } />
        <Route path="/playlists" element={
          <PlaylistsPage
            onSelectPlaylist={(id) => navigate(`/playlists/${id}`)}
            showToast={showToast}
          />
        } />
        <Route path="/playlists/:id" element={
          <PlaylistDetailPage
            onBack={() => navigate('/playlists')}
            onZoom={handleOpenLightbox}
            onLike={handleLike}
            showToast={showToast}
            onStartSlideshow={setSlideshowWallpapers}
          />
        } />
        <Route path="/feed" element={
          user ? (
            <motion.div
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransition}
              className="gallery-container"
            >
              <div className="gallery-header">
                <div>
                  <h2 className="section-title">Creator Feed</h2>
                  <p className="section-desc">Latest wallpaper uploads from contributors you follow</p>
                </div>
              </div>

              {feedLoading && feedWallpapers.length === 0 ? (
                <div className="loading-state" style={{ padding: '4rem 2rem' }}>
                  <div className="spinner"></div>
                  <p>Loading feed...</p>
                </div>
              ) : feedWallpapers.length === 0 ? (
                <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                  <Sparkles className="empty-icon" size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1.5rem auto' }} />
                  <h3>Your Feed is Empty</h3>
                  <p>Follow uploader profiles in their details modal to customize your personal feed here!</p>
                </div>
              ) : (
                <div>
                  <div className="wallpaper-grid">
                    {feedWallpapers.map((wp) => {
                      const imgSource = wp.imageUrl.startsWith('/uploads')
                        ? `${BACKEND_URL}${wp.imageUrl}`
                        : wp.imageUrl;

                      return (
                        <div
                          key={wp._id || wp.id}
                          className="wallpaper-card"
                          onClick={() => handleOpenLightbox(wp)}
                        >
                          <div className="card-img-wrapper" style={{ position: 'relative' }}>
                            <img src={imgSource} alt={wp.title} loading="lazy" />
                            {wp.isLive && (
                              <span className="live-badge" style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                background: 'rgba(235, 94, 40, 0.95)',
                                color: '#fff',
                                padding: '0.12rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                boxShadow: '0 2px 8px rgba(235, 94, 40, 0.4)',
                                zIndex: 2,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                lineHeight: '1.2'
                              }}>
                                <span className="pulse-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff' }} />
                                <span>Live</span>
                              </span>
                            )}
                          </div>
                          <div className="card-overlay">
                            <h4 className="card-title">{wp.title}</h4>
                            <span className="card-author">by {wp.uploadedBy}</span>
                            <div className="card-footer">
                              <span className="badge">{wp.category}</span>
                              <button
                                className={`btn-card-like ${user && wp.likes && wp.likes.includes(user.id) ? 'liked' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLike(wp._id || wp.id, user);
                                }}
                              >
                                <Heart size={12} fill={user && wp.likes && wp.likes.includes(user.id) ? 'currentColor' : 'none'} />
                                <span>{wp.likesCount || 0}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {feedHasMore && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
                      <button 
                        className="btn btn-outline" 
                        onClick={() => fetchFeed()} 
                        disabled={feedLoading}
                      >
                        {feedLoading ? 'Loading...' : 'Load More Uploads'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <Navigate to="/" replace />
          )
        } />
        <Route path="/wallpaper/:id" element={
          <WallpaperDetailPage
            showToast={showToast}
            onLike={handleLike}
            onToggleFeature={handleToggleFeature}
            onColorChange={setColorQuery}
          />
        } />
        <Route path="/generator" element={
          <ShaderArtCreator
            showToast={showToast}
          />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>

      <AuthModal showToast={showToast} />

      <WallpapersModal
        isOpen={isUploadOpen}
        onClose={closeUpload}
        onUpload={handleUpload}
        onUpdate={handleUpdate}
        editingWp={editingWp}
        uploadLoading={uploadLoading}
        showToast={showToast}
      />

      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={closeBulkUpload}
        onBulkUpload={handleBulkUpload}
        showToast={showToast}
      />


      {/* TOAST ALERTS */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((toast) => {
            let ToastIcon = Info;
            if (toast.type === 'success') ToastIcon = CheckCircle;
            if (toast.type === 'error') ToastIcon = AlertTriangle;

            return (
              <motion.div
                key={toast.id}
                className={`toast toast-${toast.type}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                layout
              >
                <ToastIcon size={18} />
                <span>{toast.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {slideshowWallpapers && (
        <SlideshowMode
          wallpapers={slideshowWallpapers}
          onClose={() => setSlideshowWallpapers(null)}
        />
      )}

      {/* Pull-chain theme switch lamp overlay */}
      <AnimatePresence>
        {lampAnimating && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
              zIndex: 10000,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}
          >
            {/* Ambient background flash flash during toggle */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: lampState ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.35)',
                opacity: pulling ? 1 : 0,
                transition: 'opacity 0.2s ease',
                zIndex: -1
              }}
            />

            {/* Lamp fixture container */}
            <motion.div
              initial={{ y: -450 }}
              animate={{ y: 0 }}
              exit={{ y: -450 }}
              transition={{ type: 'spring', damping: 19, stiffness: 110 }}
              style={{
                position: 'relative',
                width: '240px',
                height: '420px',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <svg width="240" height="420" viewBox="0 0 240 420" style={{ overflow: 'visible' }}>
                <defs>
                  {/* Brass metallic texture for shade and fixtures */}
                  <linearGradient id="shade-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="30%" stopColor="#f59e0b" />
                    <stop offset="70%" stopColor="#d97706" />
                    <stop offset="100%" stopColor="#78350f" />
                  </linearGradient>
                  
                  {/* Bead chain metallic reflections */}
                  <linearGradient id="metal-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="25%" stopColor="#fbbf24" />
                    <stop offset="75%" stopColor="#b45309" />
                    <stop offset="100%" stopColor="#451a03" />
                  </linearGradient>

                  {/* Gradient for realistic glow cone */}
                  <linearGradient id="light-cone" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(253, 224, 71, 0.3)" />
                    <stop offset="40%" stopColor="rgba(253, 224, 71, 0.08)" />
                    <stop offset="100%" stopColor="rgba(253, 224, 71, 0)" />
                  </linearGradient>
                </defs>

                {/* Wire cord connecting to ceiling */}
                <line x1="120" y1="0" x2="120" y2="130" stroke="#1e293b" strokeWidth="3" />
                
                {/* Yellow light cone glow from inside shade */}
                {lampState && (
                  <polygon
                    points="120,185 -140,420 380,420"
                    fill="url(#light-cone)"
                    style={{
                      filter: 'blur(15px)',
                      transformOrigin: '120px 185px',
                      mixBlendMode: 'screen'
                    }}
                  />
                )}

                {/* Physics reactive grouping: tilts and shifts when pulled */}
                <g
                  style={{
                    transform: pulling ? 'translateY(8px) rotate(-2deg)' : 'translateY(0) rotate(0deg)',
                    transition: 'transform 0.18s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    transformOrigin: '120px 0px'
                  }}
                >
                  {/* Fixture coupler */}
                  <path d="M105,130 L135,130 L130,145 L110,145 Z" fill="#475569" stroke="#334155" strokeWidth="1" />

                  {/* Brass lamp shade */}
                  <path d="M85,145 L150,145 L175,185 L65,185 Z" fill="url(#shade-gradient)" stroke="#78350f" strokeWidth="1.5" />
                  
                  {/* Outer glass bulb */}
                  <path 
                    d="M102,185 C94,192 90,202 93,214 C96,226 106,232 120,232 C134,232 144,226 147,214 C150,202 146,192 138,185 Z" 
                    fill={lampState ? "rgba(253, 224, 71, 0.15)" : "rgba(255, 255, 255, 0.02)"} 
                    stroke={lampState ? "#fef08a" : "rgba(255, 255, 255, 0.2)"} 
                    strokeWidth="1.2"
                  />
                  
                  {/* Glowing Edison filament */}
                  <path
                    d="M 112 218 L 115 198 Q 120 186 120 190 Q 120 186 125 198 L 128 218"
                    fill="none"
                    stroke={lampState ? "#fb923c" : "#475569"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ filter: lampState ? 'drop-shadow(0 0 3px #ea580c)' : 'none' }}
                  />

                  {/* Soft radial blooms */}
                  {lampState && (
                    <>
                      <circle cx="120" cy="198" r="30" fill="#fde047" style={{ filter: 'blur(8px)', opacity: 0.7 }} />
                      <circle cx="120" cy="198" r="70" fill="#fef08a" style={{ filter: 'blur(22px)', opacity: 0.35 }} />
                    </>
                  )}

                  {/* Pull chain beaded socket */}
                  <circle cx="145" cy="178" r="4.5" fill="#475569" stroke="#1e293b" />
                </g>

                {/* Overlapping realistic metal beads for the chain */}
                {(() => {
                  const yStart = pulling ? 186 : 178;
                  const yEnd = pulling ? 290 : 245;
                  const beads = [];
                  for (let y = yStart; y <= yEnd; y += 6.5) {
                    beads.push(
                      <circle
                        key={y}
                        cx="145"
                        cy={y}
                        r="3.2"
                        fill="url(#metal-gradient)"
                        stroke="#78350f"
                        strokeWidth="0.5"
                        style={{
                          transition: 'cy 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                      />
                    );
                  }
                  return beads;
                })()}
                
                {/* Brass weighted knob pull handle */}
                <circle
                  cx="145"
                  cy={pulling ? "290" : "245"}
                  r="7.5"
                  fill="url(#metal-gradient)"
                  stroke="#78350f"
                  strokeWidth="1.5"
                  style={{
                    transition: 'cy 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}
                />
              </svg>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
