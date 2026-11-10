import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import authService from '../../services/authService';
import { account } from '../../services/platformService';

const AuthContext = createContext(null);

const readStoredUser = () => {
  const savedUser = localStorage.getItem('feeloUser');
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch (error) {
    console.warn('Ignoring invalid stored auth user:', error);
    localStorage.removeItem('feeloUser');
    localStorage.removeItem('feeloToken');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('feeloToken') || null);
  const [user, setUser] = useState(readStoredUser);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);

  const openAuth = (tab = 'login') => {
    setActiveTab(tab);
    setIsAuthOpen(true);
  };

  const closeAuth = () => {
    setIsAuthOpen(false);
  };

  const storeUser = useCallback((nextUser) => {
    setUser(nextUser);
    localStorage.setItem('feeloUser', JSON.stringify(nextUser));
  }, []);

  /** Save a completed sign-in. */
  const setSession = useCallback((data) => {
    setToken(data.token);
    localStorage.setItem('feeloToken', data.token);
    storeUser(data.user);
    setTwoFactorChallenge(null);
    setIsAuthOpen(false);
  }, [storeUser]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setTwoFactorChallenge(null);
    localStorage.removeItem('feeloToken');
    localStorage.removeItem('feeloUser');
  }, []);

  /** Roles and email status can change on the server, so refresh the stored copy on load. */
  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('feeloToken')) return null;
    try {
      const { user: fresh } = await account.me();
      storeUser(fresh);
      return fresh;
    } catch (error) {
      // An invalid session (password changed, suspended, deleted) means signing out.
      if ([401, 403].includes(error.response?.status)) logout();
      return null;
    }
  }, [storeUser, logout]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const data = await authService.login(username, password);
      if (data.twoFactorRequired) {
        setTwoFactorChallenge(data.challenge);
        return { twoFactorRequired: true };
      }
      setSession(data);
      return { success: true, user: data.user };
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const verifyTwoFactor = async (code) => {
    setLoading(true);
    try {
      const data = await account.twoFactorVerify(twoFactorChallenge, code);
      setSession(data);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'That code is not correct.' };
    } finally {
      setLoading(false);
    }
  };

  const beginTwoFactor = (challenge) => setTwoFactorChallenge(challenge);
  const cancelTwoFactor = () => setTwoFactorChallenge(null);

  const register = async (username, password, email) => {
    setLoading(true);
    try {
      await authService.register(username, password, email);
      // Auto-switch to login tab
      setActiveTab('login');
      return { success: true, username };
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const updateUserAvatar = (avatarUrl) => {
    if (user) storeUser({ ...user, avatarUrl });
  };

  const updateUserData = (updatedFields) => {
    if (user) storeUser({ ...user, ...updatedFields });
  };

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        token,
        user,
        isAuthOpen,
        activeTab,
        loading,
        twoFactorChallenge,
        openAuth,
        closeAuth,
        setActiveTab,
        login,
        register,
        logout,
        setSession,
        refreshUser,
        verifyTwoFactor,
        beginTwoFactor,
        cancelTwoFactor,
        updateUserAvatar,
        updateUserData
      }
    },
    children
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
