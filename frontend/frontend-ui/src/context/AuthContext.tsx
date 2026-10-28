import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AuthUser,
  getStoredToken,
  getStoredUser,
  getCurrentUser,
  clearSession,
  setUnauthorizedHandler,
} from '../services/authApi';

interface AuthContextType {
  user: AuthUser | null;
  authChecking: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    // Register 401 interceptor
    setUnauthorizedHandler(() => {
      setUser(null);
    });

    // Restore session from sessionStorage
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }

    // Try to restore user from cache first for instant UI
    const cachedUser = getStoredUser();
    if (cachedUser) {
      setUser(cachedUser);
    }

    // Validate token with backend
    getCurrentUser()
      .then((userData) => {
        if (userData) {
          setUser(userData);
        } else {
          clearSession();
          setUser(null);
        }
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const logout = () => {
    clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authChecking, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
