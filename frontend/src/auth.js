import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import config from './config';

const AUTH_STORAGE_KEY = 'wlm-auth';
const SESSION_BOOTSTRAP_TIMEOUT_MS = 5000;
const AUTH_REQUEST_TIMEOUT_MS = 8000;
const AuthContext = createContext(null);

export const getStoredAuthToken = () => {
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved).token || null;
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

const setAxiosAuthHeader = (token) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete axios.defaults.headers.common.Authorization;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = getStoredAuthToken();

      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        setAxiosAuthHeader(savedToken);
        const response = await axios.get(config.AUTH_ME_URL, {
          timeout: SESSION_BOOTSTRAP_TIMEOUT_MS,
        });
        setToken(savedToken);
        setUser(response.data);
      } catch (error) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAxiosAuthHeader(null);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const setSession = (authPayload) => {
    const nextToken = authPayload.access_token;
    const nextUser = authPayload.user;

    setToken(nextToken);
    setUser(nextUser);
    setAxiosAuthHeader(nextToken);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: nextToken }));
  };

  const login = async (credentials) => {
    const response = await axios.post(config.AUTH_LOGIN_URL, credentials, {
      timeout: AUTH_REQUEST_TIMEOUT_MS,
    });
    setSession(response.data);
    return response.data;
  };

  const register = async (payload) => {
    const response = await axios.post(config.AUTH_REGISTER_URL, payload, {
      timeout: AUTH_REQUEST_TIMEOUT_MS,
    });
    setSession(response.data);
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAxiosAuthHeader(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = {
    token,
    user,
    isLoading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="auth-loading-screen">Checking your session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
};

export const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="auth-loading-screen">Checking your session...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};