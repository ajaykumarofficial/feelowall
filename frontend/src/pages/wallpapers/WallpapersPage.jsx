import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

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
import {
  Trees,
  Feather,
  Orbit,
  Sparkles,
  Building,
  Search,
  ImageOff,
  Maximize2,
  Edit,
  Trash2,
  Heart,
  Download,
  Play
} from 'lucide-react';

const CATEGORIES = [
  { name: 'All', icon: null },
  { name: 'Nature', icon: Trees },
  { name: 'Minimalist', icon: Feather },
  { name: 'Space', icon: Orbit },
  { name: 'Anime', icon: Sparkles },
  { name: 'Architecture', icon: Building }
];

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const WallpapersPage = ({
  wallpapers,
  loading,
  loadingMore,
  hasMore,
  loadMore,
  category,
  searchQuery,
  currentUser,
  sortBy,
  onSortChange,
  onLike,
  onCategoryChange,
  onSearchSubmit,
  onResetFilters,
  onZoom,
  onEdit,
  onDelete,
  colorQuery,
  onColorChange,
  featuredWallpapers,
  onToggleFeature,
  onStartSlideshow
}) => {
  const navigate = useNavigate();
  const sentinelRef = useRef(null);

  // IntersectionObserver to trigger loadMore when sentinel is visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);
  const [searchInput, setSearchInput] = useState(searchQuery);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchSubmit(searchInput.trim());
  };

  const handleReset = () => {
    setSearchInput('');
    onResetFilters();
  };

  return (
    <motion.div
      initial={false}
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* HERO / FEATURED SECTION */}
      {featuredWallpapers && featuredWallpapers.length > 0 ? (
        <motion.header
          className="featured-hero"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div 
            className="featured-hero-bg" 
            style={{ 
              backgroundImage: `url(${featuredWallpapers[0].imageUrl.startsWith('/uploads') ? `${BACKEND_URL}${featuredWallpapers[0].imageUrl}` : featuredWallpapers[0].imageUrl})`
            }} 
          />
          <div className="featured-hero-overlay" />
          
          <div className="featured-hero-content">
            <div className="featured-left">
              <span className="badge badge-featured" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '1rem' }}>
                <Sparkles size={12} fill="#f59e0b" />
                <span>Featured Masterpiece</span>
              </span>
              <h1 className="featured-title" style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem', fontFamily: "'Outfit', sans-serif" }}>{featuredWallpapers[0].title}</h1>
              <p className="featured-uploader" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', marginBottom: '1.8rem' }}>Curated aesthetic by <strong>{featuredWallpapers[0].uploadedBy}</strong></p>
              
              <div className="featured-actions" style={{ display: 'flex', gap: '0.8rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => onZoom(featuredWallpapers[0])} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', height: '42px', padding: '0 1.2rem' }}>
                  <Maximize2 size={16} />
                  <span>Quick View</span>
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    const downloadUrl = featuredWallpapers[0].imageUrl.startsWith('/uploads') ? `${BACKEND_URL}${featuredWallpapers[0].imageUrl}` : featuredWallpapers[0].imageUrl;
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = featuredWallpapers[0].title;
                    a.click();
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', background: 'rgba(255,255,255,0.08)', height: '42px', padding: '0 1.2rem' }}
                >
                  <Download size={16} />
                  <span>Download Original</span>
                </button>
              </div>

              {/* Integrated search inside featured banner for clean layout */}
              <div className="hero-search-box compact" style={{ maxWidth: '480px', margin: '0' }}>
                <form onSubmit={handleSearchSubmit} className="search-wrapper">
                  <Search className="hero-search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Search wallpapers..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary btn-search">Search</button>
                </form>
              </div>
            </div>

            <div className="featured-right" onClick={() => onZoom(featuredWallpapers[0])} style={{ cursor: 'pointer' }}>
              <div className="featured-preview-card" style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', transition: 'transform 0.3s ease' }}>
                <img 
                  src={featuredWallpapers[0].imageUrl.startsWith('/uploads') ? `${BACKEND_URL}${featuredWallpapers[0].imageUrl}` : featuredWallpapers[0].imageUrl} 
                  alt={featuredWallpapers[0].title} 
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '320px', objectFit: 'cover' }}
                />
                <div className="preview-card-info" style={{ position: 'absolute', bottom: '0', left: '0', width: '100%', background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))', padding: '1.2rem', color: '#fff' }}>
                  <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem' }}>{featuredWallpapers[0].title}</h4>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none' }}>{featuredWallpapers[0].category}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.header>
      ) : (
        <motion.header
          className="hero"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="hero-content">
            <h1 className="hero-title">Find Your Next <span className="text-gradient">Aesthetic</span></h1>
            <p className="hero-subtitle">High-quality, community-curated wallpapers for your devices. Open source & free.</p>

            <div className="hero-search-box">
              <form onSubmit={handleSearchSubmit} className="search-wrapper">
                <Search className="hero-search-icon" size={22} />
                <input
                  type="text"
                  placeholder="Try searching 'Nature', 'Retro', 'Space'..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-search">Search</button>
              </form>
            </div>
          </div>
        </motion.header>
      )}

      {/* Category Pills wrapper - always display below header */}
      <div className="explore-categories-wrapper" style={{ maxWidth: '1400px', margin: '2rem auto 0 auto', padding: '0 2rem' }}>
        <div className="categories-bar">
          {CATEGORIES.map((cat) => {
            const IconComp = cat.icon;
            const isActive = category === cat.name;
            return (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                key={cat.name}
                className={`category-chip ${isActive ? 'active' : ''}`}
                onClick={() => onCategoryChange(cat.name)}
              >
                {IconComp && <IconComp className="chip-icon" size={15} />}
                <span>{cat.name}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* MAIN GALLERY SECTION */}
      <main className="gallery-container" style={{ paddingTop: '1rem' }}>
        <div className="gallery-header">
          <div>
            <h2 className="section-title">Explore Wallpapers</h2>
            <p className="section-desc">
              {loading ? 'Updating directory...' : `Showing ${wallpapers.length} wallpaper${wallpapers.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Color Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>Color Search</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="color"
                  value={colorQuery || '#ff6b6b'}
                  onChange={(e) => onColorChange(e.target.value)}
                  style={{
                    border: '1px solid var(--border-color)',
                    width: '30px',
                    height: '30px',
                    padding: '0',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    overflow: 'hidden'
                  }}
                  title="Search by color"
                />
                {colorQuery && (
                  <button
                    onClick={() => onColorChange(null)}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)',
                      borderRadius: '4px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="gallery-sorting">
              <label htmlFor="sortBySelect" style={{ marginRight: '0.5rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sort by</label>
              <select
                id="sortBySelect"
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="select-dropdown"
              >
                <option value="latest">Newest</option>
                <option value="likes">Most Liked</option>
                <option value="views">Most Viewed</option>
                <option value="downloads">Most Downloaded</option>
              </select>
            </div>

            {onStartSlideshow && wallpapers && wallpapers.length > 0 && (
              <button
                onClick={() => onStartSlideshow(wallpapers)}
                className="btn btn-outline"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  height: '38px',
                  padding: '0 0.8rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-main)',
                  background: 'transparent'
                }}
                title="Start ambient slideshow mode"
              >
                <Play size={14} fill="currentColor" />
                <span>Slideshow</span>
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Fetching beautiful wallpapers...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && wallpapers.length === 0 && (
          <div className="empty-state">
            <ImageOff className="empty-icon" size={48} />
            <h3>No Wallpapers Found</h3>
            <p>Try searching for something else or be the first to upload one in this category!</p>
            <button className="btn btn-outline mt-4" onClick={handleReset}>
              Clear Search
            </button>
          </div>
        )}

        {/* Wallpaper display (Strictly Grid View) */}
        {!loading && wallpapers.length > 0 && (
          <div className="wallpaper-grid">
            {wallpapers.map((wp, index) => {
              const imgSource = wp.imageUrl.startsWith('/uploads')
                ? `${BACKEND_URL}${wp.imageUrl}`
                : wp.imageUrl;

              const isOwner = currentUser && (currentUser.id === wp.uploadedById || currentUser.username === wp.uploadedBy);

              return (
                <motion.div
                  key={wp._id || wp.id}
                  className="wallpaper-card"
                  initial={{ opacity: 0, y: 35, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "0px 0px -40px 0px" }}
                  transition={{ duration: 0.35, delay: (index % 8) * 0.04 }}
                  onClick={() => onZoom(wp)}
                >
                  <div className="card-img-wrapper" style={{ position: 'relative' }}>
                    <img src={imgSource} alt={wp.title} loading="lazy" />
                    {wp.isLive && (
                      <span className="live-badge" style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(235, 94, 40, 0.95)',
                        color: '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        boxShadow: '0 2px 10px rgba(235, 94, 40, 0.4)',
                        zIndex: 2,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        lineHeight: '1.2'
                      }}>
                        <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                        <span>Live</span>
                      </span>
                    )}
                  </div>
                  <div className="card-overlay">
                    <h4 className="card-title">{wp.title}</h4>
                    <span
                      className="card-author"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/creator/${wp.uploadedBy}`);
                      }}
                    >
                      by {wp.uploadedBy}
                    </span>
                    <div className="card-footer">
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span className="badge">{wp.category}</span>
                        <button
                          className={`btn-card-like ${currentUser && wp.likes && wp.likes.includes(currentUser.id) ? 'liked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLike(wp._id || wp.id, currentUser);
                          }}
                          title={currentUser && wp.likes && wp.likes.includes(currentUser.id) ? 'Unlike' : 'Like'}
                        >
                          <Heart size={12} fill={currentUser && wp.likes && wp.likes.includes(currentUser.id) ? 'currentColor' : 'none'} />
                          <span>{wp.likesCount || 0}</span>
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {isOwner && (
                          <>
                            <button
                              className="btn-card-action"
                              title="Edit Details"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(wp);
                              }}
                              style={{ backgroundColor: 'rgba(234, 179, 8, 0.25)', color: '#eab308' }}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="btn-card-action"
                              title="Delete Wallpaper"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(wp._id || wp.id);
                              }}
                              style={{ backgroundColor: 'rgba(239, 68, 68, 0.25)', color: '#ef4444' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        <button
                          className="btn-card-action btn-zoom"
                          title="Open View"
                          onClick={(e) => {
                            e.stopPropagation();
                            onZoom(wp);
                          }}
                        >
                          <Maximize2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Infinite Scroll Sentinel */}
        <div ref={sentinelRef} className="scroll-sentinel" />

        {/* Bottom loading spinner */}
        {loadingMore && (
          <div className="load-more-spinner">
            <div className="spinner" />
            <span>Loading more...</span>
          </div>
        )}

        {/* End of results message */}
        {!hasMore && wallpapers.length > 0 && !loading && (
          <div className="end-of-results">
            <span>✨ You've seen all {wallpapers.length} wallpapers</span>
          </div>
        )}
      </main>
    </motion.div>
  );
};

export default WallpapersPage;
