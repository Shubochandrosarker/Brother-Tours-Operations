import { api } from '@/api/client';
export function listDepartures(params = {}, signal) { return api.get('/departures', { query: { page: params.page || 1, per_page: params.perPage || 50, tour_id: params.tourId || '', from: params.from || '', to: params.to || '', status: params.status || '' }, signal }); }
export function getDeparture(id, signal) { return api.get(`/departures/${id}`, { signal }); }
export function createDeparture(data, signal) { return api.post('/departures', data, { signal }); }
export function updateDeparture(id, data, signal) { return api.patch(`/departures/${id}`, data, { signal }); }
export function deleteDeparture(id, signal) { return api.delete(`/departures/${id}`, { signal }); }
