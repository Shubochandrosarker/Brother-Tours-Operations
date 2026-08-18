import { api, setCsrfToken, verifySession } from '@/api/client';

export async function login(credentials) {
  const payload = await api.post('/auth/session/login', { username: credentials.username, password: credentials.password });
  if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
  return normalizeUser(payload?.user || payload);
}

export async function fetchSession(signal) {
  const payload = await api.get('/auth/session', { signal });
  if (payload?.csrfToken) setCsrfToken(payload.csrfToken);
  return normalizeUser(payload?.user || payload);
}

/**
 * Reads GET /auth/session immediately after a successful login to confirm the
 * browser actually stored the session cookie and will send it back. Returns the
 * user, or null when the cookie did not round-trip. Never throws a 401 — a null
 * return IS the negative answer.
 */
export async function confirmSessionCookie() {
  const payload = await verifySession();
  return normalizeUser(payload?.user || payload);
}

export async function logout() { try { await api.post('/auth/session/logout'); } finally { setCsrfToken(null); } }
export async function revokeAllSessions() { const result = await api.post('/auth/session/revoke-all'); setCsrfToken(null); return result; }

function normalizeUser(source) {
  if (!source || typeof source !== 'object' || !(source.id || source.email)) return null;
  return {
    id: String(source.id),
    name: source.displayName || source.name || source.email || 'Operator',
    email: source.email || '',
    roles: Array.isArray(source.roles) ? source.roles : [],
    capabilities: Array.isArray(source.capabilities) ? source.capabilities : [],
  };
}
export default { login, logout, fetchSession, confirmSessionCookie, revokeAllSessions };
