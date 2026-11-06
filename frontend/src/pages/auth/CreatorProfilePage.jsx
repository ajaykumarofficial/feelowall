import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from './useAuth';
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
import userService from '../../services/userService';
import { User, Heart, Eye, Download, UserPlus, UserCheck, Sparkles, AlertTriangle, ArrowLeft, Folder, Globe, Coffee, DollarSign, Edit, Trash2, Maximize2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const CreatorProfilePage = ({ username, onZoom, onLike, showToast, onEdit, onDelete }) => {
  const { username: paramUsername } = useParams();
  const activeUsername = username || paramUsername;
  const { user } = useAuth();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('wallpapers'); // 'wallpapers' | 'collections'
  const [followingList, setFollowingList] = useState([]);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchCreatorProfile = async () => {
    setLoading(true);
    try {
      const data = await userService.getCreatorProfile(activeUsername);
      setCreator(data);
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Could not load creator profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowing = async () => {
    if (!user) return;
    try {
      const list = await userService.getFollowing();
      setFollowingList(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeUsername) {
      fetchCreatorProfile();
      fetchFollowing();
    }
  }, [activeUsername, user]);

  const handleToggleFollow = async () => {
    if (!user) {
      if (showToast) showToast('Please sign in to follow creators.', 'error');
      return;
    }
    setFollowLoading(true);
    try {
      const res = await userService.toggleFollowUser(activeUsername);
      if (showToast) showToast(res.message, 'success');
      
      // Update local creator state followers count
      setCreator(prev => ({
        ...prev,
        isFollowing: res.followed,
        stats: {
          ...prev.stats,
          followersCount: res.followed ? prev.stats.followersCount + 1 : prev.stats.followersCount - 1
        }
      }));
      
      await fetchFollowing();
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to toggle follow.', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  // Helper to expand short handles to full URLs
  const getTippingUrl = (service, value) => {
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    
    if (service === 'kofi') return `https://ko-fi.com/${value}`;
    if (service === 'buyMeACoffee') return `https://buymeacoffee.com/${value}`;
    if (service === 'stripe') return value; // Stripe links should be full URLs anyway
    return value;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8rem 0' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="empty-state" style={{ padding: '6rem 2rem' }}>
        <AlertTriangle className="empty-icon" size={48} />
        <h3>Creator Not Found</h3>
        <p>The user profile you are trying to visit does not exist or has been deactivated.</p>
      </div>
    );
  }

  const isSelf = user && user.username.toLowerCase() === activeUsername.toLowerCase();
  const isFollowing = followingList.some(item => item.username.toLowerCase() === activeUsername.toLowerCase()) || creator.isFollowing;

  return (
    <motion.div
      className="gallery-container"
      initial={false}
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <div className="profile-card" style={{ padding: '2.5rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="profile-avatar" style={{ width: '80px', height: '80px', fontSize: '2rem', overflow: 'hidden', position: 'relative' }}>
              {creator.avatarUrl ? (
                <img
                  src={creator.avatarUrl.startsWith('/uploads') ? `${BACKEND_URL}${creator.avatarUrl}` : creator.avatarUrl}
                  alt={creator.username}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                creator.username.substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: '0', fontFamily: 'Outfit, sans-serif', fontSize: '2rem' }}>{creator.username}</h2>
                {!isSelf && (
                  <button
                    className="btn-follow-creator"
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    style={{
                      padding: '0.3rem 0.8rem',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      background: isFollowing ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                      color: '#ffffff',
                      border: isFollowing ? '1px solid var(--border-color)' : 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      height: '30px'
                    }}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck size={13} />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <p style={{ margin: '0.5rem 0 0.8rem 0', color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '500px', lineHeight: '1.5' }}>
                {creator.bio || "No biography provided. FeeloWall Community Contributor."}
              </p>
              
              <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span><strong>{creator.stats.followersCount}</strong> Followers</span>
                <span>•</span>
                <span><strong>{creator.wallpapers.length}</strong> Wallpapers</span>
                <span>•</span>
                <span><strong>{creator.stats.totalLikes}</strong> Likes Received</span>
              </div>

              {/* Badge mini-showcase */}
              {creator.achievements && creator.achievements.some(a => a.unlocked) && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  {creator.achievements.filter(a => a.unlocked).slice(0, 5).map(badge => {
                    const colors = {
                      views: 'rgba(6, 182, 212, 0.15)', // cyan
                      downloads: 'rgba(245, 158, 11, 0.15)', // amber
                      likes: 'rgba(239, 68, 68, 0.15)', // red
                      uploads: 'rgba(16, 185, 129, 0.15)', // emerald
                      special: 'rgba(139, 92, 246, 0.15)' // purple
                    };
                    const borderColors = {
                      views: 'rgba(6, 182, 212, 0.4)',
                      downloads: 'rgba(245, 158, 11, 0.4)',
                      likes: 'rgba(239, 68, 68, 0.4)',
                      uploads: 'rgba(16, 185, 129, 0.4)',
                      special: 'rgba(139, 92, 246, 0.4)'
                    };
                    const textColors = {
                      views: '#22d3ee',
                      downloads: '#fbbf24',
                      likes: '#f87171',
                      uploads: '#34d399',
                      special: '#a78bfa'
                    };
                    return (
                      <span
                        key={badge.id}
                        title={badge.desc}
                        style={{
                          background: colors[badge.type] || 'rgba(255,255,255,0.06)',
                          color: textColors[badge.type] || 'var(--text-main)',
                          border: `1px solid ${borderColors[badge.type] || 'var(--border-color)'}`,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}
                      >
                        🏆 {badge.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Social Support Tipping Links */}
          {(creator.tippingLinks?.kofi || creator.tippingLinks?.buyMeACoffee || creator.tippingLinks?.stripe) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '220px', background: 'rgba(255,255,255,0.02)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>SUPPORT CREATOR</span>
              
              {creator.tippingLinks.kofi && (
                <a
                  href={getTippingUrl('kofi', creator.tippingLinks.kofi)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: '#FF5E5B',
                    color: '#ffffff',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    padding: '0.5rem 0.8rem',
                    height: '36px'
                  }}
                >
                  <Coffee size={14} />
                  <span>Support on Ko-fi</span>
                </a>
              )}

              {creator.tippingLinks.buyMeACoffee && (
                <a
                  href={getTippingUrl('buyMeACoffee', creator.tippingLinks.buyMeACoffee)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: '#FFDD00',
                    color: '#000000',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    padding: '0.5rem 0.8rem',
                    height: '36px'
                  }}
                >
                  <Coffee size={14} />
                  <span>Buy me a coffee</span>
                </a>
              )}

              {creator.tippingLinks.stripe && (
                <a
                  href={getTippingUrl('stripe', creator.tippingLinks.stripe)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: '#6772E5',
                    color: '#ffffff',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    padding: '0.5rem 0.8rem',
                    height: '36px'
                  }}
                >
                  <DollarSign size={14} />
                  <span>Donate via Stripe</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile TABS */}
      <div className="dashboard-tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button
          className={`btn-nav-link ${activeTab === 'wallpapers' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallpapers')}
          style={{ borderRadius: '0', borderBottom: activeTab === 'wallpapers' ? '2px solid var(--accent)' : 'none', height: '45px' }}
        >
          Wallpapers ({creator.wallpapers.length})
        </button>
        <button
          className={`btn-nav-link ${activeTab === 'collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('collections')}
          style={{ borderRadius: '0', borderBottom: activeTab === 'collections' ? '2px solid var(--accent)' : 'none', height: '45px' }}
        >
          Collections ({creator.playlists.length})
        </button>
        <button
          className={`btn-nav-link ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
          style={{ borderRadius: '0', borderBottom: activeTab === 'achievements' ? '2px solid var(--accent)' : 'none', height: '45px' }}
        >
          Achievements ({creator.achievements ? creator.achievements.filter(a => a.unlocked).length : 0})
        </button>
      </div>

      {activeTab === 'wallpapers' && (
        <div>
          {creator.wallpapers.length === 0 ? (
            <div className="empty-state" style={{ padding: '4rem 2rem' }}>
              <User className="empty-icon" size={40} style={{ color: 'var(--text-muted)' }} />
              <h3>No Wallpapers Yet</h3>
              <p>This creator has not uploaded any wallpapers yet.</p>
            </div>
          ) : (
            <div className="wallpaper-grid">
              {creator.wallpapers.map((wp) => {
                const imgSource = wp.imageUrl.startsWith('/uploads')
                  ? `${BACKEND_URL}${wp.imageUrl}`
                  : wp.imageUrl;

                const isOwner = user && (user.id === wp.uploadedById || user.username === wp.uploadedBy);

                return (
                  <div
                    key={wp._id || wp.id}
                    className="wallpaper-card"
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
                      <span className="card-author">by {wp.uploadedBy}</span>
                      <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span className="badge">{wp.category}</span>
                          <button
                            className={`btn-card-like ${user && wp.likes && wp.likes.includes(user.id) ? 'liked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onLike(wp._id || wp.id, user);
                              // Sync state inside creator wallpapers if liked
                              setCreator(prev => {
                                const list = prev.wallpapers.map(item => {
                                  if (item._id === wp._id) {
                                    const liked = user && item.likes && item.likes.includes(user.id);
                                    return {
                                      ...item,
                                      likes: liked 
                                        ? item.likes.filter(id => id !== user.id)
                                        : [...(item.likes || []), user.id],
                                      likesCount: liked ? item.likesCount - 1 : item.likesCount + 1
                                    };
                                  }
                                  return item;
                                });
                                return { ...prev, wallpapers: list };
                              });
                            }}
                            title="Like"
                          >
                            <Heart size={12} fill={user && wp.likes && wp.likes.includes(user.id) ? 'currentColor' : 'none'} />
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'collections' && (
        <div>
          {creator.playlists.length === 0 ? (
            <div className="empty-state" style={{ padding: '4rem 2rem' }}>
              <Folder className="empty-icon" size={40} style={{ color: 'var(--text-muted)' }} />
              <h3>No Collections</h3>
              <p>This creator has not curated any public collections yet.</p>
            </div>
          ) : (
            <div className="wallpaper-grid">
              {creator.playlists.map((pl) => (
                <div
                  key={pl._id || pl.id}
                  className="wallpaper-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.location.href = `/playlists/${pl._id || pl.id}`}
                >
                  <div className="card-img-wrapper" style={{ background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>
                    <Folder size={64} style={{ color: 'var(--accent)', opacity: 0.8 }} />
                  </div>
                  <div className="card-overlay" style={{ opacity: 1, background: 'rgba(0,0,0,0.6)' }}>
                    <h4 className="card-title">{pl.name}</h4>
                    <span className="card-author" style={{ color: 'var(--text-muted)' }}>Curated by {pl.creator}</span>
                    <div className="card-footer">
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Globe size={10} /> Public
                        </span>
                        <span className="badge">{pl.wallpapers ? pl.wallpapers.length : 0} Assets</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'achievements' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          {creator.achievements ? creator.achievements.map((ach) => {
            const colors = {
              views: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(8, 145, 178, 0.02))',
              downloads: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.02))',
              likes: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(185, 28, 28, 0.02))',
              uploads: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(4, 120, 87, 0.02))',
              special: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(109, 40, 217, 0.02))'
            };
            const borderColors = {
              views: 'rgba(6, 182, 212, 0.3)',
              downloads: 'rgba(245, 158, 11, 0.3)',
              likes: 'rgba(239, 68, 68, 0.3)',
              uploads: 'rgba(16, 185, 129, 0.3)',
              special: 'rgba(139, 92, 246, 0.3)'
            };
            const themeColor = {
              views: '#22d3ee',
              downloads: '#fbbf24',
              likes: '#f87171',
              uploads: '#34d399',
              special: '#a78bfa'
            };

            const progress = Math.min(100, Math.max(0, (ach.current / ach.target) * 100));

            return (
              <div
                key={ach.id}
                style={{
                  background: ach.unlocked ? colors[ach.type] : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${ach.unlocked ? borderColors[ach.type] : 'var(--border-color)'}`,
                  opacity: ach.unlocked ? 1 : 0.4,
                  padding: '1.5rem',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  boxShadow: ach.unlocked ? `0 4px 14px -4px ${themeColor[ach.type]}30` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '2rem' }}>
                    {ach.unlocked ? '🏆' : '🔒'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: ach.unlocked ? themeColor[ach.type] : 'rgba(255,255,255,0.1)',
                      color: ach.unlocked ? '#000' : 'var(--text-muted)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {ach.unlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 700, color: 'var(--text-main)' }}>{ach.name}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{ach.desc}</p>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    <span>Progress</span>
                    <span>{ach.current} / {ach.target}</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: themeColor[ach.type] || 'var(--accent)',
                        borderRadius: '10px',
                        transition: 'width 0.4s ease-out'
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          }) : <p style={{ color: 'var(--text-muted)' }}>No achievements data available.</p>}
        </div>
      )}
    </motion.div>
  );
};

export default CreatorProfilePage;
