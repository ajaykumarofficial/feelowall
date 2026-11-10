import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../pages/auth/useAuth';
import { useI18n } from '../i18n';
import NotificationBell from './NotificationBell';
import { TagSuggestions } from '../pages/wallpapers/GalleryFilters';
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

import {
  Image,
  Search,
  Compass,
  Sun,
  Moon,
  User,
  UploadCloud,
  LogOut,
  UserCheck,
  Folder,
  Sparkles,
  Smartphone,
  Layers,
  LayoutGrid,
  Settings,
  ShieldCheck,
  Clapperboard,
  Globe
} from 'lucide-react';

const Navbar = ({
  currentPage,
  setCurrentPage,
  navSearch,
  setNavSearch,
  handleNavSearchSubmit,
  handleBrandClick,
  theme,
  toggleTheme,
  openUpload,
  openBulkUpload,
  showToast,
  deferredPrompt,
  onInstallApp
}) => {
  const { user, logout, openAuth } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { t, language, setLanguage, languages } = useI18n();
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const discoverRef = useRef(null);
  const isStaff = user && ['admin', 'moderator'].includes(user.role);

  const go = (path) => {
    navigate(path);
    setIsDropdownOpen(false);
    setIsDiscoverOpen(false);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (discoverRef.current && !discoverRef.current.contains(event.target)) {
        setIsDiscoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="navbar" aria-label="Main">
      <div className="nav-container">
        <div className="nav-brand" role="link" tabIndex={0} aria-label="FeeloWall home" onClick={handleBrandClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleBrandClick()}>
          <Image className="brand-icon" size={28} />
          <span className="brand-text">Feelo<span className="brand-accent">Wall</span></span>
        </div>

        {/* Quick Search - Hidden on Explore page */}
        {currentPage !== 'explore' && currentPage !== 'playlists' && currentPage !== 'feed' && (
          <form onSubmit={handleNavSearchSubmit} className="nav-search-container">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder={t('nav.search')}
              aria-label={t('nav.search')}
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
            />
            <TagSuggestions query={navSearch} />
          </form>
        )}

        {/* Navigation Controls */}
        <div className="nav-menu">
          <button
            className={`btn-nav-link btn-nav-link-one ${currentPage === 'explore' ? 'active' : ''}`}
            onClick={() => setCurrentPage('explore')}
            title="Explore Wallpapers"
          >
            <Compass size={18} />
            <span className="nav-btn-text">{t('nav.explore')}</span>
          </button>

          <button
            className={`btn-nav-link ${currentPage === 'playlists' || currentPage === 'playlist-detail' ? 'active' : ''}`}
            onClick={() => setCurrentPage('playlists')}
            title="Thematic Collections"
          >
            <Folder size={18} />
            <span className="nav-btn-text">{t('nav.collections')}</span>
          </button>

          <button
            className={`btn-nav-link fw-hide-phone ${currentPage === 'generator' ? 'active' : ''}`}
            onClick={() => setCurrentPage('generator')}
            title="Generative Shader Art"
          >
            <Sparkles size={18} />
            <span className="nav-btn-text">{t('nav.createArt')}</span>
          </button>

          {user && (
            <button
              className={`btn-nav-link fw-hide-phone ${currentPage === 'feed' ? 'active' : ''}`}
              onClick={() => setCurrentPage('feed')}
              title="Creator Feed"
            >
              <Sparkles size={18} />
              <span className="nav-btn-text">{t('nav.feed')}</span>
            </button>
          )}

          <div className="nav-profile-container" ref={discoverRef}>
            <button
              type="button"
              className="btn-nav-link"
              aria-expanded={isDiscoverOpen}
              onClick={() => setIsDiscoverOpen(!isDiscoverOpen)}
              title={t('nav.discover')}
            >
              <LayoutGrid size={18} aria-hidden="true" />
              <span className="nav-btn-text">{t('nav.discover')}</span>
            </button>
            {isDiscoverOpen && (
              <div className="nav-dropdown">
                {user && <button className="dropdown-item fw-phone-only" onClick={() => go('/feed')}><Sparkles size={16} aria-hidden="true" /><span>{t('nav.feed')}</span></button>}
                <button className="dropdown-item fw-phone-only" onClick={() => go('/generator')}><Sparkles size={16} aria-hidden="true" /><span>{t('nav.createArt')}</span></button>
                {user && <button className="dropdown-item" onClick={() => go('/for-you')}><Sparkles size={16} aria-hidden="true" /><span>{t('nav.forYou')}</span></button>}
                <button className="dropdown-item" onClick={() => go('/challenges')}><Clapperboard size={16} aria-hidden="true" /><span>{t('nav.challenges')}</span></button>
                <button className="dropdown-item" onClick={() => go('/leaderboard')}><UserCheck size={16} aria-hidden="true" /><span>{t('nav.leaderboard')}</span></button>
                <button className="dropdown-item" onClick={() => go('/packs')}><Layers size={16} aria-hidden="true" /><span>{t('nav.packs')}</span></button>
                <button className="dropdown-item" onClick={() => go('/tools/multi-monitor')}><Image size={16} aria-hidden="true" /><span>{t('nav.multiMonitor')}</span></button>
                <button className="dropdown-item" onClick={() => go('/developers')}><Settings size={16} aria-hidden="true" /><span>{t('nav.developers')}</span></button>
                <label className="dropdown-item fw-language fw-phone-only">
                  <Globe size={16} aria-hidden="true" />
                  <span className="fw-sr-only">{t('nav.language')}</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>

          <label className="fw-language fw-hide-phone" title={t('nav.language')}>
            <Globe size={16} aria-hidden="true" />
            <span className="fw-sr-only">{t('nav.language')}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </label>

          {user && <NotificationBell />}

          {/* Theme Toggle */}
          <button
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
            aria-label={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="nav-profile-container" ref={dropdownRef}>
              <button
                className="nav-avatar"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title="Profile Menu"
                aria-label="Profile menu"
                aria-expanded={isDropdownOpen}
                style={{ padding: user.avatarUrl ? '0' : '' }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl.startsWith('/uploads') ? `${BACKEND_URL}${user.avatarUrl}` : user.avatarUrl}
                    alt={user.username}
                    className="avatar-img"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
              </button>

              {isDropdownOpen && (
                <div className="nav-dropdown">
                  <div className="dropdown-header">
                    <span className="dropdown-header-label">{t('menu.signedInAs')}</span>
                    <span className="dropdown-header-username">{user.username}</span>
                  </div>
                  <div className="dropdown-divider"></div>

                  <button
                    className={`dropdown-item ${currentPage === 'profile' ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentPage('profile');
                      setIsDropdownOpen(false);
                    }}
                  >
                    <User size={16} />
                    <span>{t('menu.dashboard')}</span>
                  </button>

                  <button className="dropdown-item" onClick={() => go('/studio')}>
                    <Clapperboard size={16} aria-hidden="true" />
                    <span>{t('menu.studio')}</span>
                  </button>

                  <button
                    className="dropdown-item"
                    onClick={() => {
                      openUpload();
                      setIsDropdownOpen(false);
                    }}
                  >
                    <UploadCloud size={16} />
                    <span>{t('menu.upload')}</span>
                  </button>

                  <button
                    className="dropdown-item"
                    onClick={() => {
                      openBulkUpload();
                      setIsDropdownOpen(false);
                    }}
                  >
                    <Layers size={16} />
                    <span>{t('menu.bulkUpload')}</span>
                  </button>

                  <button className="dropdown-item" onClick={() => go('/settings')}>
                    <Settings size={16} aria-hidden="true" />
                    <span>{t('menu.settings')}</span>
                  </button>

                  {isStaff && (
                    <button className="dropdown-item" onClick={() => go('/admin')}>
                      <ShieldCheck size={16} aria-hidden="true" />
                      <span>{t('menu.admin')}</span>
                    </button>
                  )}

                  {deferredPrompt && (
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        onInstallApp();
                        setIsDropdownOpen(false);
                      }}
                      style={{ color: 'var(--accent)', fontWeight: 600 }}
                    >
                      <Smartphone size={16} />
                      <span>{t('menu.install')}</span>
                    </button>
                  )}

                  <div className="dropdown-divider"></div>

                  <button
                    className="dropdown-item logout-item"
                    onClick={() => {
                      logout();
                      if (showToast) showToast('Logged out successfully.', 'info');
                      setCurrentPage('explore');
                      setIsDropdownOpen(false);
                    }}
                  >
                    <LogOut size={16} />
                    <span>{t('menu.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="btn btn-outline nav-auth-btn"
              onClick={() => openAuth('login')}
              title="Sign In"
            >
              <UserCheck size={18} />
              <span className="nav-btn-text">{t('nav.signIn')}</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
