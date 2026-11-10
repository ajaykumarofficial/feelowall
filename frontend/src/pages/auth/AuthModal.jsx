import React, { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { User, Lock, X, Mail, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { account, errorMessage } from '../../services/platformService';
import { useI18n } from '../../i18n';

export const OAUTH_STATE_KEY = 'feelowall-oauth-state';

const LOGOS = {
  Google: (
    <svg className="social-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  ),
  GitHub: (
    <svg className="social-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  Discord: (
    <svg className="social-icon" viewBox="0 0 127.14 96.36" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.8,6.83,77.19,77.19,0,0,0,49.5,0,105.15,105.15,0,0,0,19.06,8.07C2.75,32.41-1.7,56.12.51,79.47a105.82,105.82,0,0,0,32,16.17,79,79,0,0,0,6.72-10.93,68.6,68.6,0,0,1-10.64-5.12c.91-.67,1.81-1.37,2.67-2.1a75.46,75.46,0,0,0,71.74,0c.86.73,1.76,1.43,2.67,2.1a68.86,68.86,0,0,1-10.64,5.12,79,79,0,0,0,6.72,10.93,105.82,105.82,0,0,0,32-16.17C129.58,50.36,124.77,26.85,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
    </svg>
  )
};

const SubmitButton = ({ busy, children }) => (
  <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
    {busy ? <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto', borderWidth: '2px' }} /> : <span>{children}</span>}
  </button>
);

const InputRow = ({ id, label, icon: Icon, ...props }) => (
  <div className="form-group">
    <label htmlFor={id}>{label}</label>
    <div className="input-wrapper">
      <Icon className="input-icon" size={18} aria-hidden="true" />
      <input id={id} {...props} />
    </div>
  </div>
);

export const AuthModal = ({ showToast }) => {
  const { isAuthOpen, activeTab, loading, closeAuth, setActiveTab, login, register, twoFactorChallenge, verifyTwoFactor, cancelTwoFactor } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState([]);

  // Clear inputs when the modal opens or changes tab
  useEffect(() => {
    setUsername('');
    setPassword('');
    setEmail('');
    setCode('');
    setForgotMode(false);
  }, [isAuthOpen, activeTab]);

  // Only show sign-in buttons for providers this server has credentials for.
  useEffect(() => {
    if (!isAuthOpen) return;
    account.oauthProviders().then((res) => setProviders(res.providers)).catch(() => setProviders([]));
  }, [isAuthOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (activeTab === 'login') {
      const res = await login(username, password);
      if (res.twoFactorRequired) return;
      if (res.success) showToast(`Welcome back, ${res.user.username}!`, 'success');
      else showToast(res.message, 'error');
    } else {
      const res = await register(username, password, email);
      if (res.success) {
        showToast(email ? 'Account created! Check your inbox to confirm your email, then log in.' : 'Registration successful! Please log in.', 'success');
      } else {
        showToast(res.message, 'error');
      }
    }
  };

  const handleCode = async (event) => {
    event.preventDefault();
    const res = await verifyTwoFactor(code.trim());
    if (res.success) showToast(`Welcome back, ${res.user.username}!`, 'success');
    else showToast(res.message, 'error');
    setCode('');
  };

  const handleForgot = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await account.forgotPassword(email.trim());
      showToast(res.message, 'success');
      setForgotMode(false);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  /** Real sign-in: the browser leaves for the provider, and comes back to /oauth/callback. */
  const startOAuth = async (provider) => {
    setBusy(true);
    try {
      const { url, state } = await account.oauthStart(provider.toLowerCase());
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
      window.location.assign(url);
    } catch (err) {
      showToast(errorMessage(err, 'Could not start sign-in.'), 'error');
      setBusy(false);
    }
  };

  const close = () => {
    cancelTwoFactor();
    closeAuth();
  };

  let body;
  if (twoFactorChallenge) {
    body = (
      <form onSubmit={handleCode} className="auth-form">
        <h3 className="form-title">{t('auth.codeTitle')}</h3>
        <p className="form-subtitle">{t('auth.codeHint')}</p>
        <InputRow
          id="twoFactorCode"
          label={t('auth.code')}
          icon={KeyRound}
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <SubmitButton busy={loading}>{t('auth.verify')}</SubmitButton>
        <button type="button" className="fw-link fw-auth-link" onClick={cancelTwoFactor}>{t('auth.back')}</button>
      </form>
    );
  } else if (forgotMode) {
    body = (
      <form onSubmit={handleForgot} className="auth-form">
        <h3 className="form-title">{t('auth.forgotTitle')}</h3>
        <p className="form-subtitle">{t('auth.forgotHint')}</p>
        <InputRow id="forgotEmail" label={t('auth.email')} icon={Mail} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <SubmitButton busy={busy}>{t('auth.sendLink')}</SubmitButton>
        <button type="button" className="fw-link fw-auth-link" onClick={() => setForgotMode(false)}>{t('auth.back')}</button>
      </form>
    );
  } else if (activeTab === 'login') {
    body = (
      <form onSubmit={handleSubmit} className="auth-form">
        <h3 className="form-title">{t('auth.welcome')}</h3>
        <p className="form-subtitle">{t('auth.welcomeHint')}</p>
        <InputRow id="loginUsername" label={t('auth.username')} icon={User} type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <InputRow id="loginPassword" label={t('auth.password')} icon={Lock} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <SubmitButton busy={loading}>{t('auth.logIn')}</SubmitButton>
        <button type="button" className="fw-link fw-auth-link" onClick={() => setForgotMode(true)}>{t('auth.forgot')}</button>
      </form>
    );
  } else {
    body = (
      <form onSubmit={handleSubmit} className="auth-form">
        <h3 className="form-title">{t('auth.create')}</h3>
        <p className="form-subtitle">{t('auth.createHint')}</p>
        <InputRow id="registerUsername" label={t('auth.username')} icon={User} type="text" autoComplete="username" minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} required />
        <InputRow id="registerEmail" label={t('auth.emailOptional')} icon={Mail} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <InputRow id="registerPassword" label={t('auth.password')} icon={Lock} type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <SubmitButton busy={loading}>{t('auth.register')}</SubmitButton>
      </form>
    );
  }

  const showTabs = !twoFactorChallenge && !forgotMode;

  return (
    <AnimatePresence>
      {isAuthOpen && (
        <motion.div
          className="modal-overlay active"
          onClick={close}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={activeTab === 'login' ? t('auth.login') : t('auth.signUp')}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && close()}
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          >
            <button className="modal-close" onClick={close} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>

            {showTabs && (
              <div className="auth-tabs">
                <button className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`} onClick={() => setActiveTab('login')}>
                  {t('auth.login')}
                </button>
                <button className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}>
                  {t('auth.signUp')}
                </button>
              </div>
            )}

            {body}

            {showTabs && providers.length > 0 && (
              <div className="fw-oauth">
                <div className="fw-oauth-divider"><span>{t('auth.or')}</span></div>
                <div className="fw-oauth-buttons">
                  {providers.map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      className={`fw-oauth-button fw-oauth-${provider.toLowerCase()}`}
                      onClick={() => startOAuth(provider)}
                      disabled={busy}
                    >
                      {LOGOS[provider]}
                      <span>{provider}</span>
                    </button>
                  ))}
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
