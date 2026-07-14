import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { userAPI, businessesAPI } from '../utils/api';
import { storage } from '../utils/helpers';

const AuthContext = createContext(null);

function clearLegacyTokenStorage() {
  // Auth moved to HttpOnly cookie; drop any old XSS-readable tokens.
  storage.remove('token');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    clearLegacyTokenStorage();
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
      setUser(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const applyAuthPayload = useCallback(async (data) => {
    clearLegacyTokenStorage();
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

  const login = useCallback(
    async (email, password) => {
      const { data } = await userAPI.login({ email, password });
      return applyAuthPayload(data);
    },
    [applyAuthPayload]
  );

  const loginWithOtp = useCallback(
    async (email, code) => {
      const { data } = await userAPI.verifyLoginOtp({ email, code });
      return applyAuthPayload(data);
    },
    [applyAuthPayload]
  );

  const logout = useCallback(async () => {
    try {
      await userAPI.logout();
    } catch {
      /* ignore */
    }
    clearLegacyTokenStorage();
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
      loginWithOtp,
      logout,
      refreshSession: loadSession,
      setUserFromProfile,
    }),
    [user, memberships, loading, login, loginWithOtp, logout, loadSession, setUserFromProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
