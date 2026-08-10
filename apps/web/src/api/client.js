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

function emitUnauthorized() {
  try { window.dispatchEvent(new CustomEvent('bt-ops:unauthorized')); } catch { /* noop */ }
}

async function refreshCsrf() {
  try {
    const response = await fetch(buildUrl('/auth/session'), { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } });
    const parsed = await parseBody(response);
    if (!response.ok) return false;
    const payload = unwrapEnvelope(parsed);
    const token = payload?.csrfToken || response.headers.get('X-BT-CSRF');
    if (token) setCsrfToken(token);
    return Boolean(token);
  } catch { return false; }
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
    throw new ApiError('Could not reach the Brother Tours API. Check the network or API CORS configuration.', { status: 0, code: 'network_unavailable', details: String(error?.message || error) });
  }

  const parsed = await parseBody(response);
  if (!response.ok) {
    const code = parsed && typeof parsed === 'object' ? (parsed.code || parsed.error?.code) : null;
    if (response.status === 403 && code === 'bt_ops_csrf_failed' && attempt === 0 && await refreshCsrf()) {
      return request(path, options, 1);
    }
    if (response.status === 401) { setCsrfToken(null); emitUnauthorized(); }
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
