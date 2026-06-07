import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { userAPI, businessesAPI } from '../utils/api';
import { storage } from '../utils/helpers';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const token = storage.get('token');
    if (!token) {
      setUser(null);
      setMemberships([]);
      setLoading(false);
      return;
    }
    try {
      const { data: profile } = await userAPI.getProfile();
      setUser(profile);
      try {
        const { data: mem } = await businessesAPI.getMyMemberships();
        setMemberships(Array.isArray(mem) ? mem : []);
      } catch {
        setMemberships([]);
      }
    } catch {
      storage.remove('token');
      setUser(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (email, password) => {
    const { data } = await userAPI.login({ email, password });
    storage.set('token', data.token);
    setUser(data.user);
    let list = [];
    try {
      const { data: mem } = await businessesAPI.getMyMemberships();
      list = Array.isArray(mem) ? mem : [];
    } catch {
      list = [];
    }
    setMemberships(list);
    return { user: data.user, memberships: list };
  }, []);

  const logout = useCallback(async () => {
    try {
      await userAPI.logout();
    } catch {
      /* ignore */
    }
    storage.remove('token');
    setUser(null);
    setMemberships([]);
  }, []);

  const setUserFromProfile = useCallback((profile) => {
    setUser(profile);
  }, []);

  const value = useMemo(
    () => ({
      user,
      memberships,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshSession: loadSession,
      setUserFromProfile,
    }),
    [user, memberships, loading, login, logout, loadSession, setUserFromProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
