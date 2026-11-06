import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../auth/useAuth';
import wallpaperService from '../../services/wallpaperService';
import userService from '../../services/userService';
import playlistService from '../../services/playlistService';
import AmbientEffects from './AmbientEffects';
import CropOverlay from './CropOverlay';
import { extractColors } from '../../utils/extractColors';
import { cropAndDownload, CROP_PRESETS } from '../../utils/cropImage';
import {
  ArrowLeft,
  User,
  Calendar,
  Tag,
  Download,
  Eye,
  Heart,
  Sliders,
  RotateCcw,
  Copy,
  FolderPlus,
  UserCheck,
  UserPlus,
  Sparkles,
  Smartphone,
  Laptop,
  Monitor,
  Search,
  Share2,
  Coffee,
  DollarSign,
  X
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

export const WallpaperDetailPage = ({ showToast, onLike, onToggleFeature, onColorChange }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [wallpaper, setWallpaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [followingList, setFollowingList] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);

  // Adjustments & Effects
  const [adjustments, setAdjustments] = useState(DEFAULT_ADJUSTMENTS);
  const [ambientEffect, setAmbientEffect] = useState('none');
  const [isPlayLive, setIsPlayLive] = useState(true);

  // Palette & Crop
  const [palette, setPalette] = useState([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState('original');
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [downloading, setDownloading] = useState(false);

  // Device Mockup States
  const [selectedDevice, setSelectedDevice] = useState('monitor');
  const [glowIntensity, setGlowIntensity] = useState(60);
  const [isMockupOpen, setIsMockupOpen] = useState(false);

  // Similar Wallpapers States
  const [similarWallpapers, setSimilarWallpapers] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!id) return;
    setSimilarLoading(true);
    wallpaperService.getSimilarWallpapers(id)
      .then((data) => {
        if (isMounted) setSimilarWallpapers(data || []);
      })
      .catch((err) => {
        console.error('Error fetching similar wallpapers:', err);
      })
      .finally(() => {
        if (isMounted) setSimilarLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const imageRef = useRef(null);

  // Fetch Wallpaper & Creator Data
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    wallpaperService.getWallpaperById(id)
      .then((data) => {
        if (!isMounted) return;
        setWallpaper(data);
        setLoading(false);
        wallpaperService.incrementViewCount(id).catch(() => {});

        // Fetch Creator Profile for Tipping links & Follow status
        if (data.uploadedBy) {
          userService.getCreatorProfile(data.uploadedBy)
            .then((creator) => {
              if (isMounted) setCreatorProfile(creator);
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) {
          if (showToast) showToast('Could not load wallpaper details.', 'error');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Load user follows & collections
  useEffect(() => {
    if (user) {
      userService.getFollowing()
        .then(setFollowingList)
        .catch(() => {});

      playlistService.getPlaylists(user.id || user._id)
        .then(setUserPlaylists)
        .catch(() => {});
    }
  }, [user]);

  // Handle Image Load & Palette Extraction
  const handleImageLoad = () => {
    if (!imageRef.current) return;
    setPaletteLoading(true);
    setTimeout(() => {
      const colors = extractColors(imageRef.current, 6);
      setPalette(colors);
      setPaletteLoading(false);
    }, 200);
  };

  // Build CSS filter string
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

  // Toggle follow
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
      showToast('Could not toggle follow.', 'error');
    }
  };

  // Add to collection
  const handleAddToPlaylist = async (playlistId) => {
    if (!playlistId || !wallpaper) return;
    if (playlistId === 'new') {
      navigate('/playlists');
      showToast('Redirected to Collections. Create a playlist here!', 'info');
      return;
    }
    try {
      await playlistService.addWallpaperToPlaylist(playlistId, wallpaper._id || wallpaper.id);
      showToast('Wallpaper added to collection!', 'success');
      if (user) {
        const list = await playlistService.getPlaylists(user.id || user._id);
        setUserPlaylists(list);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add to collection.', 'error');
    }
  };

  // Copy URL to Clipboard
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => showToast('Page URL copied to clipboard!', 'success'),
      () => showToast('Could not copy link.', 'error')
    );
  };

  // Copy Hex Color
  const copyHex = (hex) => {
    navigator.clipboard.writeText(hex).then(
      () => showToast(`Copied ${hex} to clipboard!`, 'success'),
      () => showToast('Could not copy hex.', 'error')
    );
  };

  const handleColorSearch = (hex) => {
    if (onColorChange) onColorChange(hex);
    navigate('/search');
    showToast(`Filtering wallpapers by color: ${hex}`, 'success');
  };

  // Crop Preset change
  const handleCropRatioChange = (presetValue) => {
    setSelectedCrop(presetValue);

    const preset = CROP_PRESETS.find((p) => p.value === presetValue);
    if (!preset || preset.value === 'original' || !imageRef.current) {
      setCropOffset({ x: 0, y: 0 });
      return;
    }

    const img = imageRef.current;
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

    const defaultX = (1.0 - wCrop) / 2;
    const defaultY = (1.0 - hCrop) / 2;

    setCropOffset({ x: defaultX, y: defaultY });
  };

  // Download handlers
  const handleDownloadOriginal = async () => {
    if (!wallpaper) return;
    const imageUrl = wallpaper.imageUrl.startsWith('/uploads') ? `${BACKEND_URL}${wallpaper.imageUrl}` : wallpaper.imageUrl;
    try {
      showToast('Downloading original wallpaper...', 'info');
      wallpaperService.incrementDownloadCount(wallpaper._id || wallpaper.id).catch(() => {});
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${wallpaper.title.toLowerCase().replace(/\s+/g, '-')}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Downloaded successfully!', 'success');
    } catch (err) {
      window.open(imageUrl, '_blank');
    }
  };

  const handleSmartDownload = () => {
    if (!wallpaper) return;
    const imageUrl = wallpaper.imageUrl.startsWith('/uploads') ? `${BACKEND_URL}${wallpaper.imageUrl}` : wallpaper.imageUrl;
    const preset = CROP_PRESETS.find((p) => p.value === selectedCrop);
    const ratio = preset?.ratio || null;
    const fileName = `${wallpaper.title.toLowerCase().replace(/\s+/g, '-')}-${selectedCrop}`;

    cropAndDownload(
      imageUrl,
      fileName,
      ratio,
      isAdjusted ? adjustments : null,
      () => {
        setDownloading(true);
        showToast('Processing wallpaper image...', 'info');
        wallpaperService.incrementDownloadCount(wallpaper._id || wallpaper.id).catch(() => {});
      },
      () => {
        setDownloading(false);
        showToast('Modified image downloaded!', 'success');
      },
      (err) => {
        setDownloading(false);
        showToast(`Download failed: ${err}`, 'error');
      },
      preset?.value !== 'original' ? cropOffset : null
    );
  };

  if (loading) {
    return (
      <div className="gallery-container" style={{ padding: '120px 2rem 40px 2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '3rem auto' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Loading wallpaper details...</p>
      </div>
    );
  }

  if (!wallpaper) {
    return (
      <div className="gallery-container" style={{ padding: '120px 2rem 40px 2rem', textAlign: 'center' }}>
        <h2 className="section-title">Wallpaper Not Found</h2>
        <p className="section-desc" style={{ marginBottom: '2rem' }}>The requested wallpaper may have been removed or is unavailable.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} /> Back to Explore
        </button>
      </div>
    );
  }

  const imageUrl = wallpaper.imageUrl.startsWith('/uploads') ? `${BACKEND_URL}${wallpaper.imageUrl}` : wallpaper.imageUrl;
  const videoUrl = wallpaper.videoUrl?.startsWith('/uploads') ? `${BACKEND_URL}${wallpaper.videoUrl}` : wallpaper.videoUrl;
  const isOwner = user && (user.id === wallpaper.uploadedById || user.username.toLowerCase() === wallpaper.uploadedBy.toLowerCase());
  const isLiked = user && wallpaper.likes && wallpaper.likes.includes(user.id);
  const isFollowingCreator = followingList.some(item => item.username.toLowerCase() === wallpaper.uploadedBy.toLowerCase());

  return (
    <motion.div
      className="gallery-container"
      style={{ padding: '100px 1.5rem 60px 1.5rem', maxWidth: '1400px', margin: '0 auto' }}
      initial={false}
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* Top Breadcrumb & Share Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate(-1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '38px', padding: '0 1rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            className="btn btn-outline"
            onClick={handleShare}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '38px', padding: '0 1rem' }}
          >
            <Share2 size={16} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Detail View */}
      <div className="wallpaper-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '2rem', alignItems: 'start' }}>
        {/* Left Column: Image Viewer & Ambient Tools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            className="showcase-card"
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--bg-dropdown)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '450px'
            }}
          >
            {wallpaper.isLive && isPlayLive ? (
              <video
                src={videoUrl}
                muted
                loop
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  filter: buildFilterString()
                }}
              />
            ) : (
              <img
                ref={imageRef}
                crossOrigin="anonymous"
                src={imageUrl}
                alt={wallpaper.title}
                onLoad={handleImageLoad}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  filter: buildFilterString(),
                  display: 'block'
                }}
              />
            )}

            <AmbientEffects type={ambientEffect} />

            {wallpaper.isLive && (
              <button
                onClick={() => setIsPlayLive(!isPlayLive)}
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  zIndex: 10,
                  boxShadow: 'var(--shadow-md)',
                  backdropFilter: 'blur(5px)'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isPlayLive ? '#10b981' : '#ef4444' }} />
                <span>{isPlayLive ? 'Live Loop Active' : 'Play Live Loop'}</span>
              </button>
            )}

            {cropMode && selectedCrop !== 'original' && (
              <CropOverlay
                imageRef={imageRef}
                targetRatio={CROP_PRESETS.find((p) => p.value === selectedCrop)?.ratio}
                cropOffset={cropOffset}
                onChange={setCropOffset}
              />
            )}
          </div>
          {/* Color Swatches */}
          {(palette.length > 0 || paletteLoading) && (
            <div className="color-palette" style={{ position: 'relative', left: 'auto', bottom: 'auto', right: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.8rem', background: 'var(--bg-dropdown)', padding: '1.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span className="color-palette-label" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Color Palette</span>
              {paletteLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="color-swatch swatch-skeleton" />
                ))
                : palette.map((hex) => (
                  <button
                    key={hex}
                    className="color-swatch"
                    style={{ background: hex }}
                    title={`Color ${hex}`}
                    onClick={() => copyHex(hex)}
                  >
                    <span className="swatch-tooltip" onClick={(e) => e.stopPropagation()}>
                      <span onClick={() => copyHex(hex)} title="Copy Hex" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                        <Copy size={10} /> {hex}
                      </span>
                      <span style={{ margin: '0 0.2rem', opacity: 0.5 }}>|</span>
                      <span onClick={() => handleColorSearch(hex)} title="Search Color" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: 'var(--accent)', cursor: 'pointer' }}>
                        <Search size={10} /> Search
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          )}
         

          {/* Live Adjustments & Effects Section */}
          <div className="lightbox-section" style={{ background: 'var(--bg-dropdown)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div className="lightbox-section-header" style={{ marginBottom: '1rem' }}>
              <Sliders size={16} />
              <span style={{ fontWeight: 700 }}>Live Image Adjustments</span>
              {isAdjusted && (
                <button
                  className="btn-reset-adj"
                  onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
                  title="Reset all"
                  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>

            <div className="slider-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.2rem' }}>
              {[
                { key: 'blur', label: 'Blur', min: 0, max: 20, step: 0.5, unit: 'px' },
                { key: 'brightness', label: 'Brightness', min: 0, max: 200, step: 1, unit: '%' },
                { key: 'contrast', label: 'Contrast', min: 0, max: 200, step: 1, unit: '%' },
                { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, step: 1, unit: '%' }
              ].map(({ key, label, min, max, step, unit }) => (
                <div key={key} className="slider-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span>{label}</span>
                    <span>{adjustments[key]}{unit}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={adjustments[key]}
                    onChange={(e) => setAdjustments((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ambient Overlay</label>
              <select
                value={ambientEffect}
                onChange={(e) => setAmbientEffect(e.target.value)}
                className="lightbox-select"
                style={{ width: 'auto', minWidth: '160px', padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
              >
                <option value="none">None</option>
                <option value="rain">🌧️ Subtle Rain</option>
                <option value="snow">❄️ Soft Snow</option>
                <option value="starfield">🌌 Starfield Space</option>
                <option value="parallax">✨ Mouse Parallax</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Column: Information & Actions Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Main Info Card */}
          <div style={{ background: 'var(--bg-dropdown)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="badge" style={{ background: 'rgba(235, 94, 40, 0.15)', color: 'var(--accent)', border: '1px solid rgba(235, 94, 40, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                {wallpaper.category}
              </span>
              {wallpaper.isLive && (
                <span className="badge" style={{ background: 'rgba(235, 94, 40, 0.95)', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                  LIVE
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1.2rem 0', fontFamily: "'Outfit', sans-serif" }}>
              {wallpaper.title}
            </h1>

            {/* Creator Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {creatorProfile?.avatarUrl ? (
                  <img src={creatorProfile.avatarUrl} alt={wallpaper.uploadedBy} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {wallpaper.uploadedBy[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>Creator</span>
                  <strong
                    style={{ cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}
                    onClick={() => navigate(`/creator/${wallpaper.uploadedBy}`)}
                  >
                    {wallpaper.uploadedBy}
                  </strong>
                </div>
              </div>

              {!isOwner && user && (
                <button
                  className="btn btn-outline"
                  onClick={() => handleToggleFollow(wallpaper.uploadedBy)}
                  style={{ height: '32px', padding: '0 0.8rem', fontSize: '0.78rem', borderRadius: '6px' }}
                >
                  {isFollowingCreator ? (
                    <><UserCheck size={13} style={{ marginRight: '0.3rem' }} /> Following</>
                  ) : (
                    <><UserPlus size={13} style={{ marginRight: '0.3rem' }} /> Follow</>
                  )}
                </button>
              )}
            </div>

            {/* Creator Tipping Links */}
            {creatorProfile && (creatorProfile.tippingLinks?.kofi || creatorProfile.tippingLinks?.buyMeACoffee || creatorProfile.tippingLinks?.stripe) && (
              <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.2rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
                  <DollarSign size={13} /> Support Creator
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {creatorProfile.tippingLinks.kofi && (
                    <a href={creatorProfile.tippingLinks.kofi.startsWith('http') ? creatorProfile.tippingLinks.kofi : `https://ko-fi.com/${creatorProfile.tippingLinks.kofi}`} target="_blank" rel="noreferrer" style={{ background: '#FF5E5B', color: '#fff', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Coffee size={11} /> Ko-fi
                    </a>
                  )}
                  {creatorProfile.tippingLinks.buyMeACoffee && (
                    <a href={creatorProfile.tippingLinks.buyMeACoffee.startsWith('http') ? creatorProfile.tippingLinks.buyMeACoffee : `https://buymeacoffee.com/${creatorProfile.tippingLinks.buyMeACoffee}`} target="_blank" rel="noreferrer" style={{ background: '#FFDD00', color: '#000', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Coffee size={11} /> Coffee
                    </a>
                  )}
                  {creatorProfile.tippingLinks.stripe && (
                    <a href={creatorProfile.tippingLinks.stripe} target="_blank" rel="noreferrer" style={{ background: '#6772E5', color: '#fff', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <DollarSign size={11} /> Stripe
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'var(--bg-main)', padding: '0.7rem', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Eye size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Views</span>
                  <strong style={{ fontSize: '0.9rem' }}>{wallpaper.viewsCount || 0}</strong>
                </div>
              </div>
              <div style={{ background: 'var(--bg-main)', padding: '0.7rem', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Download size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Downloads</span>
                  <strong style={{ fontSize: '0.9rem' }}>{wallpaper.downloadsCount || 0}</strong>
                </div>
              </div>
            </div>

            {/* Actions: Like, Add to Collection, Feature */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  type="button"
                  className={`btn-like-action ${isLiked ? 'liked' : ''}`}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (onLike && wallpaper) {
                      const res = await onLike(wallpaper._id || wallpaper.id, user);
                      if (res) {
                        setWallpaper(prev => prev ? {
                          ...prev,
                          likes: res.likes || (isLiked ? (prev.likes || []).filter(l => l !== user.id) : [...(prev.likes || []), user.id]),
                          likesCount: res.likesCount
                        } : null);
                      }
                    }
                  }}
                  style={{ flex: 1, height: '42px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                  <span>{wallpaper.likesCount || 0} Likes</span>
                </button>

                {isOwner && onToggleFeature && (
                  <button
                    type="button"
                    onClick={() => onToggleFeature(wallpaper._id || wallpaper.id)}
                    style={{
                      padding: '0 1rem',
                      height: '42px',
                      borderRadius: '8px',
                      background: wallpaper.isFeatured ? 'rgba(234, 179, 8, 0.15)' : 'var(--bg-main)',
                      color: wallpaper.isFeatured ? '#f59e0b' : 'var(--text-muted)',
                      border: wallpaper.isFeatured ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontWeight: 600
                    }}
                  >
                    <Sparkles size={16} fill={wallpaper.isFeatured ? '#f59e0b' : 'none'} />
                    <span>{wallpaper.isFeatured ? 'Featured' : 'Feature'}</span>
                  </button>
                )}
              </div>

              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                  <FolderPlus size={18} style={{ color: 'var(--text-muted)' }} />
                  <select
                    onChange={(e) => {
                      handleAddToPlaylist(e.target.value);
                      e.target.value = "";
                    }}
                    defaultValue=""
                    className="lightbox-select"
                    style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                  >
                    <option value="" disabled>Add to collection...</option>
                    {userPlaylists && userPlaylists.length > 0 ? (
                      userPlaylists.map(pl => (
                        <option key={pl._id || pl.id} value={pl._id || pl.id}>{pl.name}</option>
                      ))
                    ) : null}
                    <option value="new">+ Create New Collection</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Download Options Box */}
          <div style={{ background: 'var(--bg-dropdown)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Download Options</h3>

            <button
              className="btn btn-primary"
              onClick={handleDownloadOriginal}
              style={{ width: '100%', height: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700 }}
            >
              <Download size={18} />
              <span>Download Original</span>
            </button>

            <button
              className="btn btn-outline"
              onClick={() => {
                const W = window.screen.width;
                const H = window.screen.height;
                cropAndDownload(
                  imageUrl,
                  `${wallpaper.title.toLowerCase().replace(/\s+/g, '-')}-device-${W}x${H}`,
                  W / H,
                  isAdjusted ? adjustments : null,
                  () => {
                    showToast('Optimizing wallpaper for your device screen...', 'info');
                    wallpaperService.incrementDownloadCount(wallpaper._id || wallpaper.id).catch(() => {});
                  },
                  () => showToast('Device optimized image downloaded!', 'success'),
                  (err) => showToast(`Download failed: ${err}`, 'error'),
                  null
                );
              }}
              style={{ width: '100%', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(235, 94, 40, 0.05)', color: 'var(--accent)', border: '1px solid rgba(235, 94, 40, 0.25)', fontSize: '0.85rem' }}
            >
              <Smartphone size={16} />
              <span>Download for My Device ({window.screen.width}x{window.screen.height})</span>
            </button>

            <button
              className="btn btn-outline"
              onClick={() => setIsMockupOpen(true)}
              style={{ width: '100%', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
            >
              <Monitor size={16} />
              <span>Interactive Device Previews</span>
            </button>
          </div>
        </div>
      </div>

      {/* Similar Wallpapers Section */}
      <div style={{ marginTop: '4rem', borderTop: '1px solid var(--border-color)', paddingTop: '2.5rem' }}>
        <div className="gallery-header" style={{ marginBottom: '2rem' }}>
          <div>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
              <Sparkles size={20} style={{ color: 'var(--accent)' }} />
              <span>Similar Wallpapers</span>
            </h2>
            <p className="section-desc">More wallpapers with similar palettes, categories, or tags</p>
          </div>
        </div>

        {similarLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <div className="loading-spinner"></div>
          </div>
        ) : similarWallpapers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>No similar wallpapers found.</p>
        ) : (
          <div className="wallpaper-grid">
            {similarWallpapers.map((wp) => {
              const imgSource = wp.imageUrl.startsWith('/uploads')
                ? `${BACKEND_URL}${wp.imageUrl}`
                : wp.imageUrl;
              const isWpLiked = user && wp.likes && wp.likes.includes(user.id);

              return (
                <div
                  key={wp._id || wp.id}
                  className="wallpaper-card"
                  onClick={() => navigate(`/wallpaper/${wp._id || wp.id}`)}
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
                        className={`btn-card-like ${isWpLiked ? 'liked' : ''}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (onLike) {
                            const res = await onLike(wp._id || wp.id, user);
                            if (res) {
                              setSimilarWallpapers(prev => prev.map(item => {
                                if ((item._id || item.id) === (wp._id || wp.id)) {
                                  return {
                                    ...item,
                                    likes: res.likes || (isWpLiked ? (item.likes || []).filter(l => l !== user.id) : [...(item.likes || []), user.id]),
                                    likesCount: res.likesCount
                                  };
                                }
                                return item;
                              }));
                            }
                          }
                        }}
                      >
                        <Heart size={12} fill={isWpLiked ? 'currentColor' : 'none'} />
                        <span>{wp.likesCount || 0}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Device Previews Modal Popup */}

      <AnimatePresence>
        {isMockupOpen && (
          <motion.div
            className="modal-overlay active"
            onClick={() => setIsMockupOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ zIndex: 1100 }}
          >
            <motion.div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              style={{
                maxWidth: '700px',
                width: '90%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                padding: '2rem',
                gap: '1.2rem',
                position: 'relative'
              }}
            >
              <button 
                className="modal-close" 
                onClick={() => setIsMockupOpen(false)}
                style={{ top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                <Monitor className="title-icon" size={24} style={{ color: 'var(--accent)' }} />
                <span>Interactive Device Previews</span>
              </h3>
              
              <p className="form-subtitle" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                See how this wallpaper fits on a monitor, laptop, or phone screen with ambient backlight synchronization.
              </p>

              {/* Toggle bar and intensity controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {[
                    { id: 'monitor', label: 'Monitor', icon: Monitor },
                    { id: 'laptop', label: 'Laptop', icon: Laptop },
                    { id: 'phone', label: 'Phone', icon: Smartphone }
                  ].map((device) => {
                    const IconComp = device.icon;
                    const isActive = selectedDevice === device.id;
                    return (
                      <button
                        key={device.id}
                        onClick={() => setSelectedDevice(device.id)}
                        className={`btn ${isActive ? 'btn-primary' : 'btn-outline'}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          height: '34px',
                          padding: '0 0.8rem',
                          fontSize: '0.8rem',
                          background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.02)'
                        }}
                      >
                        <IconComp size={14} />
                        <span>{device.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Glow Intensity slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ambient RGB glow</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={glowIntensity}
                    onChange={(e) => setGlowIntensity(Number(e.target.value))}
                    style={{ width: '100px', accentColor: 'var(--accent)', cursor: 'pointer', height: '5px' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '30px' }}>{glowIntensity}%</span>
                </div>
              </div>

              {/* Mockup Workspace Screen */}
              <div 
                className="mockup-workspace"
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '480px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '2rem 1rem'
                }}
              >
                {/* Backlight Glow Panel */}
                <div
                  className="mockup-backlight"
                  style={{
                    position: 'absolute',
                    width: '500px',
                    height: '350px',
                    borderRadius: '50%',
                    filter: 'blur(50px)',
                    background: palette[0]?.hex || '#06b6d4',
                    opacity: (glowIntensity / 100) * 0.45,
                    transition: 'background 0.3s ease, opacity 0.15s ease',
                    pointerEvents: 'none',
                    zIndex: 0
                  }}
                />

                {/* Device Frame Renderers */}
                <div style={{ zIndex: 1, display: 'flex', justifyContent: 'center', width: '100%' }}>
                  {selectedDevice === 'monitor' && (
                    <div className="device-monitor-frame">
                      <div className="monitor-screen">
                        <img src={imageUrl} alt="Preview Screen" />
                      </div>
                      <div className="monitor-neck" />
                      <div className="monitor-base" />
                    </div>
                  )}

                  {selectedDevice === 'laptop' && (
                    <div className="device-laptop-frame">
                      <div className="laptop-screen">
                        <img src={imageUrl} alt="Preview Screen" />
                      </div>
                      <div className="laptop-keyboard" />
                    </div>
                  )}

                  {selectedDevice === 'phone' && (
                    <div className="device-phone-frame">
                      <div className="phone-screen">
                        <div className="phone-notch" />
                        <img src={imageUrl} alt="Preview Screen" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default WallpaperDetailPage;
