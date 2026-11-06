import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../../services/authService';

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

  const openAuth = (tab = 'login') => {
    setActiveTab(tab);
    setIsAuthOpen(true);
  };

  const closeAuth = () => {
    setIsAuthOpen(false);
  };

  const login = async (username, password) => {
    setLoading(true);
    try {
      const data = await authService.login(username, password);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('feeloToken', data.token);
      localStorage.setItem('feeloUser', JSON.stringify(data.user));
      closeAuth();
      return { success: true, user: data.user };
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, password) => {
    setLoading(true);
    try {
      const data = await authService.register(username, password);
      // Auto-switch to login tab and fill username
      setActiveTab('login');
      return { success: true, username };
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('feeloToken');
    localStorage.removeItem('feeloUser');
  };

  const updateUserAvatar = (avatarUrl) => {
    if (user) {
      const updatedUser = { ...user, avatarUrl };
      setUser(updatedUser);
      localStorage.setItem('feeloUser', JSON.stringify(updatedUser));
    }
  };

  const updateUserData = (updatedFields) => {
    if (user) {
      const updatedUser = { ...user, ...updatedFields };
      setUser(updatedUser);
      localStorage.setItem('feeloUser', JSON.stringify(updatedUser));
    }
  };

  const loginWithOAuth = async (provider, username, oauthId, avatarUrl) => {
    setLoading(true);
    try {
      const data = await authService.oauthLogin(provider, username, oauthId, avatarUrl);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('feeloToken', data.token);
      localStorage.setItem('feeloUser', JSON.stringify(data.user));
      closeAuth();
      return { success: true, user: data.user };
    } catch (error) {
      const msg = error.response?.data?.message || 'OAuth authentication failed.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
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
        openAuth,
        closeAuth,
        setActiveTab,
        login,
        register,
        logout,
        updateUserAvatar,
        updateUserData,
        loginWithOAuth
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
