import React, { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { User, Lock, X, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AuthModal = ({ showToast }) => {
  const { isAuthOpen, activeTab, loading, closeAuth, setActiveTab, login, register, loginWithOAuth } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // OAuth States
  const [oauthProvider, setOauthProvider] = useState(null); // 'Google' | 'GitHub' | 'Discord'
  const [oauthUsername, setOauthUsername] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  // Clear inputs when modal opens/closes
  useEffect(() => {
    setUsername('');
    setPassword('');
    setOauthProvider(null);
  }, [isAuthOpen, activeTab]);

  // Removed immediate null return to support exit transitions with AnimatePresence

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeTab === 'login') {
      const res = await login(username, password);
      if (res.success) {
        showToast(`Welcome back, ${res.user.username}!`, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } else {
      const res = await register(username, password);
      if (res.success) {
        showToast('Registration successful! Please login.', 'success');
      } else {
        showToast(res.message, 'error');
      }
    }
  };

  const handleOauthClick = (provider) => {
    setOauthProvider(provider);
    if (provider === 'Google') setOauthUsername('ajay_google');
    else if (provider === 'GitHub') setOauthUsername('ajay_github');
    else if (provider === 'Discord') setOauthUsername('ajay_discord');
  };

  const handleOauthSubmit = async (e) => {
    e.preventDefault();
    if (!oauthUsername.trim()) return;

    setOauthLoading(true);
    setTimeout(async () => {
      try {
        const fakeOauthId = `${oauthProvider.toLowerCase()}_${Math.floor(Math.random() * 1000000)}`;
        const fakeAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${oauthUsername}`;
        const res = await loginWithOAuth(oauthProvider, oauthUsername.trim(), fakeOauthId, fakeAvatar);

        if (res.success) {
          showToast(`Welcome! Signed in via ${oauthProvider} as ${res.user.username}`, 'success');
          setOauthProvider(null);
        } else {
          showToast(res.message, 'error');
        }
      } catch (err) {
        showToast('OAuth flow failed', 'error');
      } finally {
        setOauthLoading(false);
      }
    }, 1000);
  };

  // Official Logo SVG paths
  const logos = {
    Google: (
      <svg className="social-icon" viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: '0.5rem' }}>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
    GitHub: (
      <svg className="social-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ marginRight: '0.5rem' }}>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
    Discord: (
      <svg className="social-icon" viewBox="0 0 127.14 96.36" width="18" height="18" fill="currentColor" style={{ marginRight: '0.5rem' }}>
        <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.8,6.83,77.19,77.19,0,0,0,49.5,0,105.15,105.15,0,0,0,19.06,8.07C2.75,32.41-1.7,56.12.51,79.47a105.82,105.82,0,0,0,32,16.17,79,79,0,0,0,6.72-10.93,68.6,68.6,0,0,1-10.64-5.12c.91-.67,1.81-1.37,2.67-2.1a75.46,75.46,0,0,0,71.74,0c.86.73,1.76,1.43,2.67,2.1a68.86,68.86,0,0,1-10.64,5.12,79,79,0,0,0,6.72,10.93,105.82,105.82,0,0,0,32-16.17C129.58,50.36,124.77,26.85,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
      </svg>
    )
  };

  return (
    <AnimatePresence>
      {isAuthOpen && (
        <motion.div
          className="modal-overlay active"
          onClick={closeAuth}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
          >
        <button className="modal-close" onClick={closeAuth}>
          <X size={20} />
        </button>

        {/* Tab Headers */}
        <div className="auth-tabs">
          <button
            className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Login
          </button>
          <button
            className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Sign Up
          </button>
        </div>

        {/* Login Form */}
        {activeTab === 'login' ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <h3 className="form-title">Welcome Back</h3>
            <p className="form-subtitle">Enter your credentials to manage and upload wallpapers.</p>

            <div className="form-group">
              <label htmlFor="loginUsername">Username</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  type="text"
                  id="loginUsername"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="loginPassword">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  type="password"
                  id="loginPassword"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? (
                <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto', borderWidth: '2px' }}></div>
              ) : (
                <span>Log In</span>
              )}
            </button>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleSubmit} className="auth-form">
            <h3 className="form-title">Create Account</h3>
            <p className="form-subtitle">Join our community to upload and share custom wallpapers.</p>

            <div className="form-group">
              <label htmlFor="registerUsername">Username</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  type="text"
                  id="registerUsername"
                  placeholder="Minimum 3 characters"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="registerPassword">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  type="password"
                  id="registerPassword"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? (
                <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto', borderWidth: '2px' }}></div>
              ) : (
                <span>Register Account</span>
              )}
            </button>
          </form>
        )}

        {/* OAuth Buttons Section */}
        <div style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '1.2rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            <span style={{ margin: '0 0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>OR CONTINUE WITH</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', width: '100%' }}>
            <button
              onClick={() => handleOauthClick('Google')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                color: '#1f1f1f',
                border: '1px solid #dadce0',
                borderRadius: '8px',
                padding: '0.6rem 0.5rem',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              title="Continue with Google"
            >
              {logos.Google}
              <span>Google</span>
            </button>

            <button
              onClick={() => handleOauthClick('GitHub')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#24292e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 0.5rem',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
              title="Continue with GitHub"
            >
              {logos.GitHub}
              <span>GitHub</span>
            </button>

            <button
              onClick={() => handleOauthClick('Discord')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#5865F2',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 0.5rem',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
              title="Continue with Discord"
            >
              {logos.Discord}
              <span>Discord</span>
            </button>
          </div>
        </div>

        {/* OAuth Simulated Consent Popups */}
        {oauthProvider && (
          <div
            className="modal-overlay active"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              background: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                background: oauthProvider === 'Google' ? '#ffffff' : oauthProvider === 'GitHub' ? '#0d1117' : '#313338',
                color: oauthProvider === 'Google' ? '#1f1f1f' : '#ffffff',
                width: '100%',
                maxWidth: '400px',
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                border: oauthProvider === 'Google' ? 'none' : '1px solid var(--border-color)',
                overflow: 'hidden',
                position: 'relative',
                animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* Header Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.2rem',
                  borderBottom: oauthProvider === 'Google' ? '1px solid #f1f3f4' : '1px solid rgba(255,255,255,0.08)',
                  background: oauthProvider === 'Google' ? '#f8f9fa' : oauthProvider === 'GitHub' ? '#161b22' : '#2b2d31'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {logos[oauthProvider]}
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                    {oauthProvider} Single Sign-On
                  </span>
                </div>
                <button
                  onClick={() => setOauthProvider(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: oauthProvider === 'Google' ? '#5f6368' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.2rem'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleOauthSubmit} style={{ padding: '1.5rem 1.2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: oauthProvider === 'Google' ? 'rgba(66, 133, 244, 0.1)' : oauthProvider === 'GitHub' ? 'rgba(255,255,255,0.05)' : 'rgba(88, 101, 242, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.8rem auto'
                    }}
                  >
                    {oauthProvider === 'Google' ? (
                      <ShieldAlert size={26} color="#4285F4" />
                    ) : oauthProvider === 'GitHub' ? (
                      <ShieldAlert size={26} color="#ffffff" />
                    ) : (
                      <ShieldAlert size={26} color="#5865F2" />
                    )}
                  </div>
                  <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem' }}>Authorize FeeloWall</h4>
                  <p style={{ margin: '0', fontSize: '0.8rem', color: oauthProvider === 'Google' ? '#5f6368' : 'var(--text-muted)' }}>
                    FeeloWall is requesting access to read your profile name and avatar.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      marginBottom: '0.4rem',
                      color: oauthProvider === 'Google' ? '#3c4043' : 'var(--text-muted)',
                      display: 'block'
                    }}
                    htmlFor="oauthUsernameInput"
                  >
                    Choose Social Username
                  </label>
                  <input
                    type="text"
                    id="oauthUsernameInput"
                    value={oauthUsername}
                    onChange={(e) => setOauthUsername(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '6px',
                      border: oauthProvider === 'Google' ? '1px solid #dadce0' : '1px solid rgba(255,255,255,0.15)',
                      background: oauthProvider === 'Google' ? '#ffffff' : '#1e1f22',
                      color: oauthProvider === 'Google' ? '#1f1f1f' : '#ffffff',
                      fontSize: '0.9rem'
                    }}
                    placeholder="Enter social nickname"
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setOauthProvider(null)}
                    style={{
                      flex: 1,
                      background: oauthProvider === 'Google' ? '#ffffff' : 'transparent',
                      color: oauthProvider === 'Google' ? '#1a73e8' : '#ffffff',
                      border: oauthProvider === 'Google' ? '1px solid #dadce0' : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      padding: '0.6rem 0',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={oauthLoading}
                    style={{
                      flex: 1,
                      background: oauthProvider === 'Google' ? '#1a73e8' : oauthProvider === 'GitHub' ? '#238636' : '#5865F2',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.6rem 0',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {oauthLoading ? (
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: '#fff' }} />
                    ) : (
                      <span>Authorize</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};

export default AuthModal;
