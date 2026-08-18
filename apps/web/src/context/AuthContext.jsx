import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { confirmSessionCookie, fetchSession, login as loginRequest, logout as logoutRequest } from '@/api/auth';
import { API_BASE, ApiError } from '@/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('LOADING');
  const [error, setError] = useState(null);
  // Why the operator was signed out, so /login can say so instead of silently
  // presenting an empty form after an apparently successful sign-in.
  const [signedOutReason, setSignedOutReason] = useState(null);

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
    const handler = (event) => {
      setUser(null);
      setStatus('EMPTY');
      setError(null);
      setSignedOutReason(event?.detail?.reason || 'Your session has ended. Please sign in again.');
    };
    window.addEventListener('bt-ops:unauthorized', handler);
    return () => window.removeEventListener('bt-ops:unauthorized', handler);
  }, []);

  const login = useCallback(async (credentials) => {
    const session = await loginRequest(credentials);
    if (!session) throw new ApiError('Login succeeded but the server did not return an operations user.', { status: 502, code: 'empty_session' });

    // The login response alone does not prove the browser stored the cookie and
    // will send it back. Confirm the round-trip before navigating, so a cookie
    // that never lands reports itself instead of bouncing off the dashboard.
    let confirmed = null;
    try {
      confirmed = await confirmSessionCookie();
    } catch (err) {
      throw err instanceof ApiError ? err : new ApiError(String(err?.message || err));
    }
    if (!confirmed) {
      throw new ApiError(
        `Signed in, but the browser did not return the session cookie. This usually means the app origin and the API origin are not both HTTPS on the same domain, or third-party cookies are blocked. API: ${API_BASE || '(not configured)'}`,
        { status: 401, code: 'bt_ops_cookie_not_returned' },
      );
    }

    setUser(confirmed);
    setStatus('DATA');
    setError(null);
    setSignedOutReason(null);
    return confirmed;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutRequest(); } finally {
      setUser(null);
      setStatus('EMPTY');
      setSignedOutReason('You have been signed out.');
    }
  }, []);

  const clearSignedOutReason = useCallback(() => setSignedOutReason(null), []);

  const value = useMemo(() => ({
    user, status, error, signedOutReason, apiBase: API_BASE,
    isAuthenticated: Boolean(user), isResolving: status === 'LOADING',
    login, logout, clearSignedOutReason, refresh: () => loadSession(),
  }), [user, status, error, signedOutReason, login, logout, clearSignedOutReason, loadSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
