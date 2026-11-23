import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api';
import { disconnectSocket } from '../lib/socket';

export type UserRole = 'CENTRAL_ADMIN' | 'HOSTEL_MANAGER' | 'HOSTEL_STAFF' | 'TRAVELLER';

export interface AuthUser {
  id: string;
  nickname: string;
  email: string | null;
  role: UserRole;
  hostelId: string | null;
  hostelName: string | null;
  hostelCity: string | null;
  avatar?: string | null;
  interests?: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: AuthUser }>('/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      disconnectSocket();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshAuth, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
