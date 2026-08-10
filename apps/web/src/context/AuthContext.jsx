import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSession, login as loginRequest, logout as logoutRequest } from '@/api/auth';
import { ApiError } from '@/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('LOADING');
  const [error, setError] = useState(null);

  const loadSession = useCallback(async (signal) => {
    setStatus('LOADING');
    setError(null);
    try {
      const session = await fetchSession(signal);
      setUser(session);
      setStatus(session ? 'DATA' : 'EMPTY');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setUser(null);
      if (err instanceof ApiError && err.isUnauthorized) { setStatus('EMPTY'); return; }
      if (err instanceof ApiError && err.isForbidden) {
        setError(new ApiError('Access denied. Your account does not have permission to access this console.', { status: 403, code: 'forbidden' }));
        setStatus('ERROR');
        return;
      }
      const wrapped = err instanceof ApiError ? err : new ApiError(String(err?.message || err));
      setError(wrapped);
      setStatus(wrapped.isUnavailable ? 'UNAVAILABLE' : 'ERROR');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSession(controller.signal);
    return () => controller.abort();
  }, [loadSession]);

  useEffect(() => {
    const handler = () => { setUser(null); setStatus('EMPTY'); setError(null); };
    window.addEventListener('bt-ops:unauthorized', handler);
    return () => window.removeEventListener('bt-ops:unauthorized', handler);
  }, []);

  const login = useCallback(async (credentials) => {
    const session = await loginRequest(credentials);
    if (!session) throw new ApiError('Login succeeded but the server did not return an operations user.', { status: 502, code: 'empty_session' });
    setUser(session); setStatus('DATA'); setError(null); return session;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutRequest(); } finally { setUser(null); setStatus('EMPTY'); }
  }, []);

  const value = useMemo(() => ({
    user, status, error, isAuthenticated: Boolean(user), isResolving: status === 'LOADING',
    login, logout, refresh: () => loadSession(),
  }), [user, status, error, login, logout, loadSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
