import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, getAccessToken, setTokens, clearTokens } from '../lib/api';

interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (accessToken: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getAccessToken();
    if (stored) {
      setToken(stored);
      api.get<User>('/api/users/me')
        .then(u => setUser(u))
        .catch(() => {
          clearTokens();
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (accessToken: string, u: User, refreshToken?: string) => {
    setTokens(accessToken, refreshToken);
    setToken(accessToken);
    setUser(u);
  };

  const logout = () => {
    clearTokens();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
