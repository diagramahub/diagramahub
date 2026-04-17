import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User, LoginResponse } from '../types/auth';
import apiService from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);

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
  }, []);

  const verifyToken = async () => {
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
    } catch (error) {
      // Token is invalid, clear everything
      logout();
    } finally {
      setLoading(false);
    }
  };

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
      localStorage.setItem('token', access_token);
      setToken(access_token);

      // Track whether MFA is enabled for this user (for MfaBanner)
      setMfaEnabled(response.mfa_enabled ?? false);

      // Fetch user data
      const userData = await apiService.getCurrentUser();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
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

  const register = async (email: string, password: string, fullName?: string) => {
    try {
      await apiService.register({ email, password, full_name: fullName });
      // Auto login after registration
      await login(email, password);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    mfaEnabled,
    login,
    completeMfaLogin,
    register,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
