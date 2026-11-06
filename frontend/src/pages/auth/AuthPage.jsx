import React, { useState, useEffect } from 'react';
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
import AuthTable from './AuthTable';
import { User, LogIn, Heart, Eye, Download, Camera, Settings, Laptop, Clipboard, Check, Key, Code, HelpCircle, Coffee, DollarSign, Settings2, BarChart2, TrendingUp, Sparkles } from 'lucide-react';
import userService from '../../services/userService';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const AuthPage = ({ wallpapers, onEdit, onDelete, onZoom, onLike, showToast }) => {
  const { user, token, openAuth, updateUserAvatar, updateUserData } = useAuth();
  const [activeTab, setActiveTab] = useState('uploads'); // 'uploads' | 'favorites' | 'analytics' | 'settings' | 'cli'
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Settings Form States
  const [bio, setBio] = useState(user?.bio || '');
  const [kofi, setKofi] = useState(user?.tippingLinks?.kofi || '');
  const [buyMeACoffee, setBuyMeACoffee] = useState(user?.tippingLinks?.buyMeACoffee || '');
  const [stripe, setStripe] = useState(user?.tippingLinks?.stripe || '');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Analytics States
  const [analyticsData, setAnalyticsData] = useState([]);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Profile data for Achievements
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (user && user.username) {
      setProfileLoading(true);
      userService.getCreatorProfile(user.username)
        .then(data => {
          setProfileData(data);
          setProfileLoading(false);
        })
        .catch(err => {
          console.error('Error fetching own profile for achievements:', err);
          setProfileLoading(false);
        });
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'analytics') {
      setAnalyticsLoading(true);
      userService.getAnalytics(analyticsDays)
        .then(data => {
          setAnalyticsData(data);
          setAnalyticsLoading(false);
        })
        .catch(err => {
          console.error('Error fetching analytics:', err);
          if (showToast) showToast('Failed to load analytics data.', 'error');
          setAnalyticsLoading(false);
        });
    }
  }, [user, activeTab, analyticsDays, showToast]);

  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setKofi(user.tippingLinks?.kofi || '');
      setBuyMeACoffee(user.tippingLinks?.buyMeACoffee || '');
      setStripe(user.tippingLinks?.stripe || '');
    }
  }, [user]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (showToast) showToast('Avatar image size must be less than 5MB.', 'error');
      else alert('Avatar image size must be less than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploadingAvatar(true);
    try {
      const data = await userService.updateAvatar(formData);
      updateUserAvatar(data.avatarUrl);
      if (showToast) showToast('Avatar updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to upload avatar.';
      if (showToast) showToast(errMsg, 'error');
      else alert(errMsg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Filter wallpapers uploaded by this user
  const userWallpapers = user
    ? wallpapers.filter((wp) => wp.uploadedById === user.id || wp.uploadedBy === user.username)
    : [];

  // Filter wallpapers liked by this user
  const likedWallpapers = user
    ? wallpapers.filter((wp) => wp.likes && wp.likes.includes(user.id))
    : [];

  // Calculate statistics
  const totalViews = userWallpapers.reduce((sum, wp) => sum + (wp.viewsCount || 0), 0);
  const totalDownloads = userWallpapers.reduce((sum, wp) => sum + (wp.downloadsCount || 0), 0);
  const totalLikes = userWallpapers.reduce((sum, wp) => sum + (wp.likesCount || 0), 0);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const data = await userService.updateProfile({
        bio,
        tippingLinks: { kofi, buyMeACoffee, stripe }
      });
      updateUserData(data.user);
      if (showToast) showToast('Settings updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to update settings.';
      if (showToast) showToast(errMsg, 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const copyToClipboard = (text, flagSetter) => {
    navigator.clipboard.writeText(text).then(() => {
      flagSetter(true);
      if (showToast) showToast('Copied to clipboard!', 'success');
      setTimeout(() => flagSetter(false), 2000);
    });
  };

  return (
    <motion.div
      className="gallery-container"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {user ? (
        <div>
          <div className="gallery-header">
            <h2 className="section-title">My Profile Dashboard</h2>
            <p className="section-desc">Manage your uploads and account statistics</p>
          </div>

          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar-container" style={{ position: 'relative' }}>
                <div className="profile-avatar" style={{ overflow: 'hidden', position: 'relative' }}>
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl.startsWith('/uploads') ? `${BACKEND_URL}${user.avatarUrl}` : user.avatarUrl}
                      alt={user.username}
                      className="avatar-img"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    />
                  ) : (
                    user.username.substring(0, 2).toUpperCase()
                  )}
                  <label htmlFor="avatar-upload" className="avatar-upload-overlay" title="Upload avatar">
                    <Camera size={14} style={{ color: '#fff' }} />
                  </label>
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                    disabled={uploadingAvatar}
                  />
                </div>
                {uploadingAvatar && <div className="avatar-upload-spinner" />}
              </div>
              <div className="profile-details">
                <h3>{user.username}</h3>
                <p>FeeloWall Community Contributor</p>
                {/* Badge mini-showcase */}
                {profileData?.achievements && profileData.achievements.some(a => a.unlocked) && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                    {profileData.achievements.filter(a => a.unlocked).slice(0, 5).map(badge => {
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
                            padding: '0.15rem 0.4rem',
                            borderRadius: '12px',
                            fontSize: '0.68rem',
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

            <div className="profile-stats">
              <div className="stat-box">
                <div className="stat-value">{userWallpapers.length}</div>
                <div className="stat-label">Published</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{totalLikes}</div>
                <div className="stat-label">Likes Received</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{totalViews}</div>
                <div className="stat-label">Total Views</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{totalDownloads}</div>
                <div className="stat-label">Downloads</div>
              </div>
            </div>
          </div>

          {/* DASHBOARD TABS */}
          <div className="dashboard-tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', marginTop: '3rem', overflowX: 'auto' }}>
            <button
              className={`btn-nav-link ${activeTab === 'uploads' ? 'active' : ''}`}
              onClick={() => setActiveTab('uploads')}
              style={{ borderRadius: '0', borderBottom: activeTab === 'uploads' ? '2px solid var(--accent)' : 'none', height: '45px', whiteSpace: 'nowrap' }}
            >
              My Uploads ({userWallpapers.length})
            </button>
            <button
              className={`btn-nav-link ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
              style={{ borderRadius: '0', borderBottom: activeTab === 'favorites' ? '2px solid var(--accent)' : 'none', height: '45px', whiteSpace: 'nowrap' }}
            >
              My Favorites ({likedWallpapers.length})
            </button>
            <button
              className={`btn-nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
              style={{ borderRadius: '0', borderBottom: activeTab === 'analytics' ? '2px solid var(--accent)' : 'none', height: '45px', whiteSpace: 'nowrap' }}
            >
              My Analytics
            </button>
            <button
              className={`btn-nav-link ${activeTab === 'achievements' ? 'active' : ''}`}
              onClick={() => setActiveTab('achievements')}
              style={{ borderRadius: '0', borderBottom: activeTab === 'achievements' ? '2px solid var(--accent)' : 'none', height: '45px', whiteSpace: 'nowrap' }}
            >
              My Achievements ({profileData?.achievements ? profileData.achievements.filter(a => a.unlocked).length : 0})
            </button>
            <button
              className={`btn-nav-link ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
              style={{ borderRadius: '0', borderBottom: activeTab === 'settings' ? '2px solid var(--accent)' : 'none', height: '45px', whiteSpace: 'nowrap' }}
            >
              Creator Settings
            </button>
            <button
              className={`btn-nav-link ${activeTab === 'cli' ? 'active' : ''}`}
              onClick={() => setActiveTab('cli')}
              style={{ borderRadius: '0', borderBottom: activeTab === 'cli' ? '2px solid var(--accent)' : 'none', height: '45px', whiteSpace: 'nowrap' }}
            >
              Desktop Sync
            </button>
          </div>

          {activeTab === 'uploads' ? (
            <div>
              <div className="gallery-header">
                <h3 className="section-title" style={{ fontSize: '1.4rem' }}>My Upload History</h3>
                <p className="section-desc">Showing list of custom uploaded assets</p>
              </div>
              <AuthTable
                wallpapers={wallpapers}
                user={user}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ) : activeTab === 'favorites' ? (
            <div>
              <div className="gallery-header">
                <h3 className="section-title" style={{ fontSize: '1.4rem' }}>My Liked Wallpapers</h3>
                <p className="section-desc">Showcasing your favorite collected aesthetics</p>
              </div>

              {likedWallpapers.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                  <Heart className="empty-icon" size={40} style={{ color: 'var(--text-muted)' }} />
                  <h3>No Favorites Yet</h3>
                  <p>You haven't liked any wallpapers yet. Head over to Explore and hit the heart icon on your favorite designs!</p>
                </div>
              ) : (
                <div className="wallpaper-grid">
                  {likedWallpapers.map((wp) => {
                    const imgSource = wp.imageUrl.startsWith('/uploads')
                      ? `${BACKEND_URL}${wp.imageUrl}`
                      : wp.imageUrl;

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
                          <div className="card-footer">
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <span className="badge">{wp.category}</span>
                              <button
                                className="btn-card-like liked"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLike(wp._id || wp.id, user);
                                }}
                                title="Unlike"
                              >
                                <Heart size={12} fill="currentColor" />
                                <span>{wp.likesCount || 0}</span>
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
          ) : activeTab === 'analytics' ? (
            <div>
              <div className="gallery-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 className="section-title" style={{ fontSize: '1.4rem' }}>Creator Performance Analytics</h3>
                  <p className="section-desc">Track views, downloads, and user engagement over time</p>
                </div>
                {/* Time Range Selector */}
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    className={`btn`}
                    type="button"
                    onClick={() => setAnalyticsDays(7)}
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      background: analyticsDays === 7 ? 'var(--accent)' : 'transparent',
                      color: analyticsDays === 7 ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: 'bold'
                    }}
                  >
                    7 Days
                  </button>
                  <button
                    className={`btn`}
                    type="button"
                    onClick={() => setAnalyticsDays(30)}
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      background: analyticsDays === 30 ? 'var(--accent)' : 'transparent',
                      color: analyticsDays === 30 ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: 'bold'
                    }}
                  >
                    30 Days
                  </button>
                </div>
              </div>

              {analyticsLoading ? (
                <div className="loading-state" style={{ padding: '6rem 2rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading creator insights...</p>
                </div>
              ) : analyticsData.length === 0 ? (
                <div className="empty-state" style={{ padding: '4rem 2rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <BarChart2 className="empty-icon" size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1.5rem auto' }} />
                  <h3>No Analytics Data Available</h3>
                  <p>Check back tomorrow after your wallpapers receive some views, downloads, or likes!</p>
                </div>
              ) : (() => {
                // Calculate aggregated metrics for the current period
                const periodViews = analyticsData.reduce((sum, d) => sum + d.views, 0);
                const periodDownloads = analyticsData.reduce((sum, d) => sum + d.downloads, 0);
                const periodLikes = analyticsData.reduce((sum, d) => sum + d.likes, 0);
                const conversionRate = periodViews > 0 ? ((periodDownloads / periodViews) * 100).toFixed(1) : 0;

                // SVG Chart Calculations
                const maxVal = Math.max(...analyticsData.map(d => Math.max(d.views, d.downloads)), 10);
                const roundedMax = Math.max(Math.ceil(maxVal / 5) * 5, 5);

                const width = 650;
                const height = 280;
                const padL = 50;
                const padR = 20;
                const padT = 20;
                const padB = 40;
                const chartW = width - padL - padR;
                const chartH = height - padT - padB;

                // Path builder helpers
                const getX = (index) => padL + (index / (analyticsData.length - 1)) * chartW;
                const getY = (val) => height - padB - (val / roundedMax) * chartH;

                const viewsPath = analyticsData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.views)}`).join(' ');
                const viewsArea = `${viewsPath} L ${padL + chartW} ${height - padB} L ${padL} ${height - padB} Z`;

                const downloadsPath = analyticsData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.downloads)}`).join(' ');
                const downloadsArea = `${downloadsPath} L ${padL + chartW} ${height - padB} L ${padL} ${height - padB} Z`;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
                    {/* Period highlight stats card */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                      <div className="stat-box" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.02)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Eye size={12} style={{ color: 'var(--accent)' }} />
                          <span>VIEWS</span>
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>{periodViews}</div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Over last {analyticsDays} days</span>
                      </div>
                      <div className="stat-box" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.02)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Download size={12} style={{ color: 'var(--accent-magenta)' }} />
                          <span>DOWNLOADS</span>
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>{periodDownloads}</div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Over last {analyticsDays} days</span>
                      </div>
                      <div className="stat-box" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'rgba(255, 176, 32, 0.02)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Heart size={12} style={{ color: '#ffb020' }} />
                          <span>LIKES RATIO</span>
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>{periodLikes >= 0 ? `+${periodLikes}` : periodLikes}</div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Net likes trend</span>
                      </div>
                      <div className="stat-box" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.01)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <TrendingUp size={12} style={{ color: 'var(--accent)' }} />
                          <span>ENGAGEMENT RATE</span>
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>{conversionRate}%</div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Downloads / Views</span>
                      </div>
                    </div>

                    {/* Custom SVG Chart card */}
                    <div style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.5rem 1rem 1rem 1rem',
                      position: 'relative',
                      boxShadow: 'var(--shadow-md)',
                      backdropFilter: 'blur(5px)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', fontSize: '0.75rem', marginBottom: '1rem', paddingRight: '1rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-main)' }}>
                          <span style={{ width: '12px', height: '3px', background: 'var(--accent)', borderRadius: '2px' }} />
                          Views
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-main)' }}>
                          <span style={{ width: '12px', height: '3px', background: 'var(--accent-magenta)', borderRadius: '2px' }} />
                          Downloads
                        </span>
                      </div>

                      <div style={{ width: '100%', overflowX: 'auto' }}>
                        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible', minWidth: '550px' }}>
                          <defs>
                            {/* Gradients */}
                            <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="downloadsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--accent-magenta)" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="var(--accent-magenta)" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                            const val = Math.round(roundedMax * ratio);
                            const y = height - padB - ratio * chartH;
                            return (
                              <g key={index}>
                                <line
                                  x1={padL}
                                  y1={y}
                                  x2={padL + chartW}
                                  y2={y}
                                  stroke="var(--border-color)"
                                  strokeDasharray="4 4"
                                />
                                <text
                                  x={padL - 10}
                                  y={y + 4}
                                  fill="var(--text-muted)"
                                  fontSize="10"
                                  textAnchor="end"
                                  fontWeight="600"
                                  fontFamily="monospace"
                                >
                                  {val}
                                </text>
                              </g>
                            );
                          })}

                          {/* X-axis dates (filtered for legibility in 30 days) */}
                          {analyticsData.map((d, i) => {
                            const showLabel = analyticsDays === 7 || i % 5 === 0 || i === analyticsData.length - 1;
                            if (!showLabel) return null;

                            const x = getX(i);
                            const dateObj = new Date(d.date + 'T00:00:00');
                            const labelStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                            return (
                              <g key={i}>
                                <line
                                  x1={x}
                                  y1={height - padB}
                                  x2={x}
                                  y2={height - padB + 5}
                                  stroke="var(--border-color)"
                                />
                                <text
                                  x={x}
                                  y={height - padB + 18}
                                  fill="var(--text-muted)"
                                  fontSize="9"
                                  textAnchor="middle"
                                  fontWeight="600"
                                  transform={`rotate(0, ${x}, ${height - padB + 18})`}
                                >
                                  {labelStr}
                                </text>
                              </g>
                            );
                          })}

                          {/* Area Fills */}
                          <path d={viewsArea} fill="url(#viewsGrad)" />
                          <path d={downloadsArea} fill="url(#downloadsGrad)" />

                          {/* Line Paths */}
                          <path
                            d={viewsPath}
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0 2px 8px var(--accent-glow))' }}
                          />
                          <path
                            d={downloadsPath}
                            fill="none"
                            stroke="var(--accent-magenta)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Hover circles */}
                          {analyticsData.map((d, i) => {
                            if (hoveredIdx !== i) return null;
                            return (
                              <g key={i}>
                                <circle
                                  cx={getX(i)}
                                  cy={getY(d.views)}
                                  r="5"
                                  fill="var(--accent)"
                                  stroke="#fff"
                                  strokeWidth="1.5"
                                />
                                <circle
                                  cx={getX(i)}
                                  cy={getY(d.downloads)}
                                  r="5"
                                  fill="var(--accent-magenta)"
                                  stroke="#fff"
                                  strokeWidth="1.5"
                                />
                              </g>
                            );
                          })}

                          {/* Vertical guide line on hover */}
                          {hoveredIdx !== null && (
                            <line
                              x1={getX(hoveredIdx)}
                              y1={padT}
                              x2={getX(hoveredIdx)}
                              y2={height - padB}
                              stroke="var(--accent)"
                              strokeWidth="1"
                              strokeDasharray="2 2"
                              style={{ opacity: 0.5 }}
                            />
                          )}

                          {/* Interactive Hover rectangles */}
                          {analyticsData.map((d, i) => {
                            const zoneWidth = chartW / (analyticsData.length - 1);
                            const x = getX(i) - zoneWidth / 2;
                            return (
                              <rect
                                key={i}
                                x={x}
                                y={padT}
                                width={zoneWidth}
                                height={chartH}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredIdx(i)}
                                onMouseLeave={() => setHoveredIdx(null)}
                              />
                            );
                          })}
                        </svg>
                      </div>

                      {/* Tooltip Overlay */}
                      {(() => {
                        if (hoveredIdx === null) return null;
                        const hoveredData = analyticsData[hoveredIdx];
                        const dateObj = new Date(hoveredData.date + 'T00:00:00');
                        const leftPercent = padL + (hoveredIdx / (analyticsData.length - 1)) * chartW;
                        
                        return (
                          <div className="chart-tooltip" style={{
                            position: 'absolute',
                            left: `${(leftPercent / width) * 100}%`,
                            top: '45px',
                            transform: 'translateX(-50%)',
                            background: 'var(--bg-dropdown)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.6rem 0.8rem',
                            zIndex: 10,
                            pointerEvents: 'none',
                            boxShadow: 'var(--shadow-md)',
                            backdropFilter: 'blur(10px)',
                            minWidth: '130px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem'
                          }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem', marginBottom: '0.2rem' }}>
                              {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', gap: '1rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent)' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                                Views:
                              </span>
                              <strong style={{ color: 'var(--text-main)' }}>{hoveredData.views}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', gap: '1rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-magenta)' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-magenta)' }} />
                                Downloads:
                              </span>
                              <strong style={{ color: 'var(--text-main)' }}>{hoveredData.downloads}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', gap: '1rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ffb020' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffb020' }} />
                                Likes:
                              </span>
                              <strong style={{ color: 'var(--text-main)' }}>{hoveredData.likes}</strong>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : activeTab === 'achievements' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', marginTop: '1rem', marginBottom: '3rem' }}>
              {profileData?.achievements ? profileData.achievements.map((ach) => {
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
          ) : activeTab === 'settings' ? (
            <div>
              <div className="gallery-header">
                <h3 className="section-title" style={{ fontSize: '1.4rem' }}>Creator Profile Settings</h3>
                <p className="section-desc">Manage your bio, description, and tipping links</p>
              </div>

              <form onSubmit={handleSaveSettings} style={{ maxWidth: '600px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
                <div className="form-group">
                  <label htmlFor="bioInput" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    <User size={16} />
                    <span>Biography</span>
                  </label>
                  <textarea
                    id="bioInput"
                    placeholder="Tell the community about yourself, your setup themes, or design style..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={300}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      color: 'var(--text-color)',
                      resize: 'none',
                      fontSize: '0.95rem'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {bio.length}/300
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <Settings2 size={16} />
                    <span>Social Tipping & Monetization</span>
                  </h4>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Add your tipping links to let users reward you. FeeloWall displays support buttons on your public profile and wallpapers.
                  </p>

                  <div className="form-group">
                    <label htmlFor="kofiInput" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                      <Coffee size={14} style={{ color: '#FF5E5B' }} />
                      <span>Ko-fi Username or URL</span>
                    </label>
                    <input
                      type="text"
                      id="kofiInput"
                      placeholder="e.g. ko-fi.com/username or username"
                      value={kofi}
                      onChange={(e) => setKofi(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.8rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        color: 'var(--text-color)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="buyMeACoffeeInput" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                      <Coffee size={14} style={{ color: '#FFDD00' }} />
                      <span>Buy Me A Coffee Username or URL</span>
                    </label>
                    <input
                      type="text"
                      id="buyMeACoffeeInput"
                      placeholder="e.g. buymeacoffee.com/username or username"
                      value={buyMeACoffee}
                      onChange={(e) => setBuyMeACoffee(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.8rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        color: 'var(--text-color)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="stripeInput" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                      <DollarSign size={14} style={{ color: '#6772E5' }} />
                      <span>Stripe Payment Link URL</span>
                    </label>
                    <input
                      type="text"
                      id="stripeInput"
                      placeholder="e.g. buy.stripe.com/..."
                      value={stripe}
                      onChange={(e) => setStripe(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.7rem 0.8rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        color: 'var(--text-color)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={settingsLoading} style={{ alignSelf: 'flex-start', padding: '0.7rem 2rem', marginTop: '1rem', height: '40px' }}>
                  {settingsLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div className="gallery-header" style={{ marginBottom: '2rem' }}>
                <h3 className="section-title" style={{ fontSize: '1.4rem' }}>Desktop Sync Client</h3>
                <p className="section-desc">Rotate your favorite FeeloWall wallpapers automatically on your desktop setup</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', marginBottom: '3rem' }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Step 1 */}
                  <div style={{ display: 'flex', gap: '1.2rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(235, 94, 40, 0.12)',
                      color: 'var(--accent)',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      flexShrink: 0
                    }}>1</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>Download the Client Script</h4>
                      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        Save the lightweight client script directly to a local folder on your computer.
                      </p>
                      <button className="btn btn-primary" onClick={() => window.open(`${BACKEND_URL}/cli/feelowall-cli.js`, '_blank')} style={{ height: '38px', padding: '0 1.2rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Download size={14} />
                        <span>Download feelowall-cli.js</span>
                      </button>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div style={{ display: 'flex', gap: '1.2rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(235, 94, 40, 0.12)',
                      color: 'var(--accent)',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      flexShrink: 0
                    }}>2</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>Install Dependencies</h4>
                      <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        Make sure you have <strong>Node.js</strong> installed. Open your terminal in the directory where you saved the file and install the required library:
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121214', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.8rem 1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#f8f8f2' }}>
                        <span>npm install axios</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText('npm install axios');
                            showToast('Dependency command copied!', 'success');
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                          <Clipboard size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div style={{ display: 'flex', gap: '1.2rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(235, 94, 40, 0.12)',
                      color: 'var(--accent)',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      flexShrink: 0
                    }}>3</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>Link your Account</h4>
                      <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        Authenticate the script by logging in with your username and password. This lets the CLI fetch your personal liked wallpapers list:
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121214', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.8rem 1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#f8f8f2', overflowX: 'auto', marginBottom: '1rem' }}>
                        <span>node feelowall-cli.js login {BACKEND_URL} {user.username} &lt;your_password&gt;</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`node feelowall-cli.js login ${BACKEND_URL} ${user.username} <your_password>`);
                            showToast('Authentication command copied!', 'success');
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '0.5rem' }}
                        >
                          <Clipboard size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div style={{ display: 'flex', gap: '1.2rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'rgba(235, 94, 40, 0.12)',
                      color: 'var(--accent)',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      flexShrink: 0
                    }}>4</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>Sync or Rotate Wallpapers</h4>
                      <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        Run the <strong>sync</strong> command to immediately download and set a random liked wallpaper, or run the <strong>rotate</strong> command to set up an automated background changer (e.g. rotating every 30 minutes):
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121214', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.8rem 1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#f8f8f2' }}>
                          <span>node feelowall-cli.js sync</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText('node feelowall-cli.js sync');
                              showToast('Sync command copied!', 'success');
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            <Clipboard size={14} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#121214', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.8rem 1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#f8f8f2' }}>
                          <span>node feelowall-cli.js rotate 30</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText('node feelowall-cli.js rotate 30');
                              showToast('Rotation command copied!', 'success');
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            <Clipboard size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state" style={{ margin: '4rem auto', maxWidth: '600px' }}>
          <User className="empty-icon" size={48} />
          <h3>Sign In to Your Dashboard</h3>
          <p>Join the FeeloWall community to upload wallpapers, view your publication history, and manage your contributions.</p>
          <button className="btn btn-primary mt-4" onClick={() => openAuth('login')}>
            <LogIn size={18} />
            <span>Sign In Now</span>
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default AuthPage;
