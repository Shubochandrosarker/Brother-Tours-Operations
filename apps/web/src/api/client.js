/**
 * Centralized Brother Tours Operations API client.
 * WordPress remains the source of truth. Authentication is an HttpOnly cookie;
 * the only client-held auth material is the short-lived CSRF token in memory.
 */
export const API_BASE = import.meta.env.VITE_BT_API_BASE || '';

export class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = meta.status ?? 0;
    this.code = meta.code ?? 'unknown_error';
    this.details = meta.details ?? null;
  }
  get isUnavailable() { return this.status === 0 || [502,503,504].includes(this.status); }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
}

let csrfToken = null;
export function setCsrfToken(token) { csrfToken = token || null; }
export function getCsrfToken() { return csrfToken; }

function baseUrl() {
  if (!API_BASE) throw new ApiError('API base URL is not configured (VITE_BT_API_BASE).', { status: 0, code: 'missing_api_base' });
  const value = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
  return /^https?:\/\//i.test(value) ? value : new URL(value, window.location.origin).toString();
}

function buildUrl(path, query) {
  const url = new URL(String(path || '').replace(/^\//, ''), baseUrl());
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

/** True for the session routes themselves, which must never trigger a re-verify. */
function isSessionRoute(path) {
  return /^\/?auth\/session(\/|$)/.test(String(path || ''));
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  try { return type.includes('application/json') ? await response.json() : await response.text(); }
  catch { return null; }
}

function messageFromBody(body, fallback) {
  if (!body) return fallback;
  if (typeof body === 'string' && body.trim()) return body.slice(0, 500);
  if (typeof body === 'object') return body.message || body.error?.message || body.detail || fallback;
  return fallback;
}

export function unwrapEnvelope(body) {
  if (body && typeof body === 'object' && body.success === true && Object.prototype.hasOwnProperty.call(body, 'data')) return body.data;
  return body;
}

/**
 * Signals that the session is genuinely gone. `reason` reaches the login screen
 * so an eviction is never silent.
 */
function emitUnauthorized(reason) {
  try { window.dispatchEvent(new CustomEvent('bt-ops:unauthorized', { detail: { reason: reason || null } })); }
  catch { /* noop */ }
}

/**
 * Fetches GET /auth/session directly, bypassing request() so it can never
 * recurse into the 401 re-verification path. Returns the unwrapped payload on
 * success, or null when the session is gone. Throws on a transport failure so
 * callers can tell "signed out" apart from "cannot reach the API".
 */
async function readSession() {
  let response;
  try {
    response = await fetch(buildUrl('/auth/session'), {
      method: 'GET', credentials: 'include', headers: { Accept: 'application/json' },
    });
  } catch (error) {
    throw new ApiError('Could not reach the Brother Tours API.', { status: 0, code: 'network_unavailable', details: String(error?.message || error) });
  }
  const parsed = await parseBody(response);
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new ApiError(messageFromBody(parsed, `Session check failed with status ${response.status}.`), {
      status: response.status, code: `http_${response.status}`, details: parsed,
    });
  }
  const payload = unwrapEnvelope(parsed);
  const token = payload?.csrfToken || response.headers.get('X-BT-CSRF');
  if (token) setCsrfToken(token);
  return payload;
}

// A single in-flight session check shared by concurrent callers, so a burst of
// 401s from parallel data calls produces one re-verification, not a stampede.
let sessionCheck = null;
export function verifySession() {
  if (!sessionCheck) {
    sessionCheck = readSession().finally(() => { sessionCheck = null; });
  }
  return sessionCheck;
}

export async function request(path, options = {}, attempt = 0) {
  const { method = 'GET', body, query, signal, headers = {} } = options;
  const finalHeaders = { Accept: 'application/json', ...headers };
  const upper = method.toUpperCase();
  const isWrite = !['GET','HEAD','OPTIONS'].includes(upper);
  if (isWrite && body !== undefined && !(body instanceof FormData)) finalHeaders['Content-Type'] = 'application/json';
  if (isWrite && csrfToken) finalHeaders['X-BT-CSRF'] = csrfToken;

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method: upper,
      credentials: 'include',
      signal,
      headers: finalHeaders,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    // A transport failure is not a signed-out state. It must never evict the
    // session — it surfaces as an unavailable-service error instead.
    throw new ApiError('Could not reach the Brother Tours API. Check the network or API CORS configuration.', { status: 0, code: 'network_unavailable', details: String(error?.message || error) });
  }

  const parsed = await parseBody(response);
  if (!response.ok) {
    const code = parsed && typeof parsed === 'object' ? (parsed.code || parsed.error?.code) : null;
    if (response.status === 403 && code === 'bt_ops_csrf_failed' && attempt === 0) {
      let refreshed = false;
      try { refreshed = Boolean(await verifySession()); } catch { refreshed = false; }
      if (refreshed) return request(path, options, 1);
    }

    if (response.status === 401) {
      if (isSessionRoute(path)) {
        // The session endpoint is authoritative: a 401 here IS the signed-out state.
        setCsrfToken(null);
        emitUnauthorized('Your session has ended. Please sign in again.');
      } else {
        // A 401 from a data route is not proof the session is gone. Re-verify once
        // before evicting the operator mid-task.
        let session = null;
        let reachable = true;
        try { session = await verifySession(); }
        catch { reachable = false; }

        if (session) {
          // Session is intact — this 401 was specific to the requested resource.
          throw new ApiError(messageFromBody(parsed, 'You are not authorized to access this resource.'), {
            status: 401, code: code || 'http_401', details: parsed,
          });
        }
        if (!reachable) {
          throw new ApiError('Could not reach the Brother Tours API to confirm your session.', {
            status: 0, code: 'network_unavailable', details: parsed,
          });
        }
        setCsrfToken(null);
        emitUnauthorized('Your session has ended. Please sign in again.');
      }
    }

    throw new ApiError(messageFromBody(parsed, `Request failed with status ${response.status}.`), {
      status: response.status,
      code: code || `http_${response.status}`,
      details: parsed,
    });
  }

  const unwrapped = unwrapEnvelope(parsed);
  const token = response.headers.get('X-BT-CSRF') || unwrapped?.csrfToken || unwrapped?.csrf_token || null;
  if (token) setCsrfToken(token);
  return unwrapped;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
export default api;
