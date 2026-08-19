import { api } from '@/api/client';

export function listContentTypes(signal) { return api.get('/content/types', { signal }); }

export function listContent(params = {}, signal) {
  return api.get('/content/posts', {
    query: {
      type: params.type || 'post',
      status: params.status || '',
      search: params.search || '',
      page: params.page || 1,
      per_page: params.perPage || 20,
      orderby: params.orderby || 'modified',
      order: (params.order || 'DESC').toUpperCase(),
      author: params.author || '',
      category: params.category || '',
    },
    signal,
  });
}

export function getContent(id, signal) { return api.get(`/content/posts/${id}`, { signal }); }
export function createContent(data, signal) { return api.post('/content/posts', data, { signal }); }
export function updateContent(id, data, signal) { return api.patch(`/content/posts/${id}`, data, { signal }); }
export function deleteContent(id, signal, force = false) { return api.delete(`/content/posts/${id}`, { signal, query: force ? { force: true } : undefined }); }
export function restoreContent(id, signal) { return api.post(`/content/posts/${id}/restore`, {}, { signal }); }
export function listRevisions(id, signal) { return api.get(`/content/posts/${id}/revisions`, { signal }); }

export function listTaxonomies(type = 'post', signal) { return api.get('/content/taxonomies', { query: { type }, signal }); }
export function listTerms(taxonomy, search = '', signal) { return api.get('/content/terms', { query: { taxonomy, search }, signal }); }
export function createTerm(taxonomy, name, signal) { return api.post('/content/terms', { taxonomy, name }, { signal }); }
