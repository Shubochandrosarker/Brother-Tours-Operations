import { api } from '@/api/client';

export function fetchAnalyticsStatus(signal) { return api.get('/analytics/status', { signal }); }
export function fetchSearchConsole(days = 28, signal) { return api.get('/analytics/search-console', { query: { days }, signal }); }
export function fetchGa4(days = 28, signal) { return api.get('/analytics/ga4', { query: { days }, signal }); }
export function fetchPageSpeed(params = {}, signal) { return api.get('/analytics/pagespeed', { query: { url: params.url || '', strategy: params.strategy || 'mobile' }, signal }); }
export function runPageSpeed(params = {}, signal) { return api.post('/analytics/pagespeed/run', { url: params.url || '', strategy: params.strategy || 'mobile' }, { signal }); }
export function fetchNotFoundLog(params = {}, signal) { return api.get('/analytics/404s', { query: { page: params.page || 1, per_page: params.perPage || 25 }, signal }); }
