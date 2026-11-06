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
import { Search, ImageOff, Maximize2, Edit, Trash2, Heart } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const SearchPage = ({
  wallpapers,
  loading,
  loadingMore,
  hasMore,
  loadMore,
  searchQuery,
  category,
  currentUser,
  sortBy,
  onSortChange,
  onLike,
  onSearchSubmit,
  onResetFilters,
  onZoom,
  onEdit,
  onDelete
}) => {
  const navigate = useNavigate();
  const sentinelRef = useRef(null);
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync state if searchQuery changes externally
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Infinite scroll
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
      className="gallery-container"
      style={{ padding: '110px 1.5rem 40px 1.5rem' }}
      initial={false}
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {/* Search Header */}
      <motion.div
        className="search-header-container"
        style={{ marginBottom: '2.5rem' }}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="section-title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>
          Search Results
        </h2>
        <p className="section-desc" style={{ fontSize: '1.05rem', color: 'var(--text-muted)' }}>
          {searchQuery ? (
            <>
              Showing results for <strong className="text-gradient">"{searchQuery}"</strong>
              {category && category !== 'All' && ` in ${category}`}
            </>
          ) : (
            <>
              Showing all wallpapers
              {category && category !== 'All' && ` in category "${category}"`}
            </>
          )}
        </p>
      </motion.div>

      {/* Grid Controls / Info bar */}
      <div className="gallery-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div>
          <span className="section-desc" style={{ fontWeight: 600 }}>
            {loading ? 'Searching directory...' : `${wallpapers.length} wallpaper${wallpapers.length === 1 ? '' : 's'} found`}
          </span>
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
      </div>

      {/* Loading state */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Finding wallpapers...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && wallpapers.length === 0 && (
        <div className="empty-state" style={{ marginTop: '3rem' }}>
          <ImageOff className="empty-icon" size={48} />
          <h3>No Results Found</h3>
          <p>We couldn't find any wallpapers matching your query. Try a different keyword!</p>
          <button className="btn btn-outline mt-4" onClick={handleReset}>
            Clear Search
          </button>
        </div>
      )}

      {/* Grid Display */}
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
          <span>✨ End of search results</span>
        </div>
      )}
    </motion.div>
  );
};

export default SearchPage;
