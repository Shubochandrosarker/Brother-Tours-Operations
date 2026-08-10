import { api } from '@/api/client';
export function listTeam(params = {}, signal) { return api.get('/team', { query: { page: params.page || 1, per_page: params.perPage || 50, search: params.search || '' }, signal }); }
export function getTeamMember(id, signal) { return api.get(`/team/${id}`, { signal }); }
