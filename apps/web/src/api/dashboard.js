import { api } from '@/api/client';
export function fetchDashboard(params = {}, signal) { return api.get('/dashboard', { query: params, signal }); }
