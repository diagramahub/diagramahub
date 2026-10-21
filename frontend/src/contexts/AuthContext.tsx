import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthContextType, User, LoginResponse } from '../types/auth';
import apiService from '../services/api';
import { apiErrorMessage } from '../utils/apiError';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('oauth_session');
    setToken(null);
    setUser(null);
  }, []);

  const verifyToken = useCallback(async () => {
    try {
      const userData = await apiService.getCurrentUser();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      // Fetch MFA status to keep banner state accurate
      try {
        const mfaStatus = await apiService.getMfaStatus();
        setMfaEnabled(mfaStatus.enabled);
      } catch {
        // MFA status fetch failed — default to false (show banner)
      }
    } catch {
      // Token is invalid, clear everything
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    // Load user and token from localStorage on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Verify token is still valid
      verifyToken();
    } else {
      setLoading(false);
    }
  }, [verifyToken]);

  const login = async (email: string, password: string): Promise<LoginResponse | void> => {
    try {
      const response = await apiService.login({ email, password });

      // Clear MFA banner dismissal on every new login session
      localStorage.removeItem('mfa_banner_dismissed');

      // Check if MFA verification is required
      if (response.mfa_required) {
        // Do NOT store token or set user — return MFA data for LoginPage to handle
        return response as LoginResponse;
      }

      const { access_token } = response;

      // Standard login (no MFA required)
      if (!access_token) {
        throw new Error('No access token received');
      }
      localStorage.setItem('token', access_token);
      setToken(access_token);

      // Track whether MFA is enabled for this user (for MfaBanner)
      setMfaEnabled(response.mfa_enabled ?? false);

      // Fetch user data
      const userData = await apiService.getCurrentUser();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error: unknown) {
      throw new Error(apiErrorMessage(error) || 'Login failed');
    }
  };

  const completeMfaLogin = async (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    setMfaEnabled(true);

    // Fetch user data
    const userData = await apiService.getCurrentUser();
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const loginWithOAuth = async (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('oauth_session', 'true');
    setToken(accessToken);

    // Fetch user data
    const userData = await apiService.getCurrentUser();
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));

    // Fetch MFA status for banner accuracy
    try {
      const mfaStatus = await apiService.getMfaStatus();
      setMfaEnabled(mfaStatus.enabled);
    } catch {
      // MFA status fetch failed — default to false
    }
  };

  const register = async (email: string, password: string, fullName?: string) => {
    try {
      await apiService.register({ email, password, full_name: fullName });
      // Auto login after registration
      await login(email, password);
    } catch (error: unknown) {
      throw new Error(apiErrorMessage(error) || 'Registration failed');
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    mfaEnabled,
    login,
    completeMfaLogin,
    loginWithOAuth,
    register,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider; editing this file reloads instead of hot-swapping
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
