import { api } from '@/api/client';
export function listDestinations(params = {}, signal) { return api.get('/destinations', { query: { page: params.page || 1, per_page: params.perPage || 20, search: params.search || '' }, signal }); }
export function getDestination(id, signal) { return api.get(`/destinations/${id}`, { signal }); }
export function createDestination(data, signal) { return api.post('/destinations', data, { signal }); }
export function updateDestination(id, data, signal) { return api.patch(`/destinations/${id}`, data, { signal }); }
export function deleteDestination(id, signal, force = false) { return api.delete(`/destinations/${id}`, { signal, query: force ? { force: true } : undefined }); }

export function listExperiences(params = {}, signal) { return api.get('/experiences', { query: { page: params.page || 1, per_page: params.perPage || 20, search: params.search || '', destination_id: params.destinationId || '' }, signal }); }
export function getExperience(id, signal) { return api.get(`/experiences/${id}`, { signal }); }
export function createExperience(data, signal) { return api.post('/experiences', data, { signal }); }
export function updateExperience(id, data, signal) { return api.patch(`/experiences/${id}`, data, { signal }); }
export function deleteExperience(id, signal, force = false) { return api.delete(`/experiences/${id}`, { signal, query: force ? { force: true } : undefined }); }
