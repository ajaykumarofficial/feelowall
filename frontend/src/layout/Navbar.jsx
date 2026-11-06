import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../pages/auth/useAuth';
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
  Layers
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

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand" onClick={handleBrandClick}>
          <Image className="brand-icon" size={28} />
          <span className="brand-text">Feelo<span className="brand-accent">Wall</span></span>
        </div>

        {/* Quick Search - Hidden on Explore page */}
        {currentPage !== 'explore' && currentPage !== 'playlists' && currentPage !== 'feed' && (
          <form onSubmit={handleNavSearchSubmit} className="nav-search-container">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Search wallpapers..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
            />
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
            <span className="nav-btn-text">Explore</span>
          </button>

          <button
            className={`btn-nav-link ${currentPage === 'playlists' || currentPage === 'playlist-detail' ? 'active' : ''}`}
            onClick={() => setCurrentPage('playlists')}
            title="Thematic Collections"
          >
            <Folder size={18} />
            <span className="nav-btn-text">Collections</span>
          </button>

          <button
            className={`btn-nav-link ${currentPage === 'generator' ? 'active' : ''}`}
            onClick={() => setCurrentPage('generator')}
            title="Generative Shader Art"
          >
            <Sparkles size={18} />
            <span className="nav-btn-text">Create Art</span>
          </button>

          {user && (
            <button
              className={`btn-nav-link ${currentPage === 'feed' ? 'active' : ''}`}
              onClick={() => setCurrentPage('feed')}
              title="Creator Feed"
            >
              <Sparkles size={18} />
              <span className="nav-btn-text">Feed</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="nav-profile-container" ref={dropdownRef}>
              <button
                className="nav-avatar"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title="Profile Menu"
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
                    <span className="dropdown-header-label">Signed in as</span>
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
                    <span>My Dashboard</span>
                  </button>

                  <button
                    className="dropdown-item"
                    onClick={() => {
                      openUpload();
                      setIsDropdownOpen(false);
                    }}
                  >
                    <UploadCloud size={16} />
                    <span>Upload Wallpaper</span>
                  </button>

                  <button
                    className="dropdown-item"
                    onClick={() => {
                      openBulkUpload();
                      setIsDropdownOpen(false);
                    }}
                  >
                    <Layers size={16} />
                    <span>Bulk Upload</span>
                  </button>

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
                      <span>Install App</span>
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
                    <span>Log Out</span>
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
              <span className="nav-btn-text">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
