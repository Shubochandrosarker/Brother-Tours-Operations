import { api } from '@/api/client';
export function fetchSystemHealth(signal) { return api.get('/system/health', { signal }); }
