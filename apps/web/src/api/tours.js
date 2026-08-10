import { api } from '@/api/client';
export function fetchTours(params = {}, signal) {
  return api.get('/tours', { query: { page: params.page || 1, per_page: params.perPage || 20, search: params.search || '', status: params.status || '', orderby: params.orderby || 'modified', order: (params.order || 'DESC').toUpperCase() }, signal });
}
export function fetchTour(id, signal) { return api.get(`/tours/${id}`, { signal }); }
export function createTour(data, signal) { return api.post('/tours', data, { signal }); }
export function updateTour(id, data, signal) { return api.patch(`/tours/${id}`, data, { signal }); }
export function deleteTour(id, signal, force = false) { return api.delete(`/tours/${id}`, { signal, query: force ? { force: true } : undefined }); }
