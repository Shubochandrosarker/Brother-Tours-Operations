import { api } from '@/api/client';
export function listConnections(signal) { return api.get('/connections', { signal }); }
export function createConnection(data, signal) { return api.post('/connections', data, { signal }); }
export function updateConnection(id, data, signal) { return api.patch(`/connections/${id}`, data, { signal }); }
export function deleteConnection(id, signal) { return api.delete(`/connections/${id}`, { signal }); }
export function listConnectionLogs(params = {}, signal) { return api.get('/connections/logs', { query: { page: params.page || 1, per_page: params.perPage || 50, connection_id: params.connectionId || '', event: params.event || '', status: params.status || '' }, signal }); }
