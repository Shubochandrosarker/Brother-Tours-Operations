import { api, API_BASE, ApiError, getCsrfToken, unwrapEnvelope } from '@/api/client';

export function listMedia(params = {}, signal) {
  return api.get('/media', {
    query: {
      search: params.search || '',
      page: params.page || 1,
      per_page: params.perPage || 40,
      mime_type: params.mimeType || '',
    },
    signal,
  });
}

export function getMedia(id, signal) { return api.get(`/media/${id}`, { signal }); }
export function updateMedia(id, data, signal) { return api.patch(`/media/${id}`, data, { signal }); }
export function deleteMedia(id, signal, force = false) { return api.delete(`/media/${id}`, { signal, query: force ? { force: true } : undefined }); }

/**
 * Uploads one file, reporting progress.
 *
 * `fetch` has no upload progress event, so this is the one call in the app that
 * uses XMLHttpRequest. It mirrors request() exactly on the things that matter:
 * credentials are included so the session cookie travels, and X-BT-CSRF is set
 * from the same in-memory token. Content-Type is deliberately NOT set — the
 * browser must add the multipart boundary itself.
 *
 * @param {File} file
 * @param {{title?: string, alt?: string, caption?: string}} fields
 * @param {(percent: number) => void} [onProgress]
 * @param {AbortSignal} [signal]
 */
export function uploadMedia(file, fields = {}, onProgress, signal) {
  return new Promise((resolve, reject) => {
    if (!API_BASE) {
      reject(new ApiError('API base URL is not configured (VITE_BT_API_BASE).', { status: 0, code: 'missing_api_base' }));
      return;
    }

    const body = new FormData();
    body.append('file', file);
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') body.append(key, String(value));
    });

    const base = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', new URL('media', base).toString(), true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    const csrf = getCsrfToken();
    if (csrf) xhr.setRequestHeader('X-BT-CSRF', csrf);

    if (typeof onProgress === 'function') {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
    }

    const abort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) { xhr.abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
    }
    const cleanup = () => signal?.removeEventListener('abort', abort);

    xhr.addEventListener('load', () => {
      cleanup();
      let parsed = null;
      try { parsed = JSON.parse(xhr.responseText); } catch { parsed = null; }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(unwrapEnvelope(parsed));
        return;
      }
      reject(new ApiError(
        parsed?.message || `Upload failed with status ${xhr.status}.`,
        { status: xhr.status, code: parsed?.code || `http_${xhr.status}`, details: parsed },
      ));
    });

    xhr.addEventListener('error', () => {
      cleanup();
      reject(new ApiError('Could not reach the Brother Tours API to upload this file.', { status: 0, code: 'network_unavailable' }));
    });

    xhr.addEventListener('abort', () => {
      cleanup();
      const error = new Error('Upload aborted');
      error.name = 'AbortError';
      reject(error);
    });

    xhr.send(body);
  });
}
