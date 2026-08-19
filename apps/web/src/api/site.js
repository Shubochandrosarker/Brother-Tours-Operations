import { api } from '@/api/client';

export function fetchSiteOverview(signal) { return api.get('/site/overview', { signal }); }
export function fetchSitePlugins(signal) { return api.get('/site/plugins', { signal }); }
export function fetchSiteUsers(signal) { return api.get('/site/users', { signal }); }
export function fetchSiteCron(signal) { return api.get('/site/cron', { signal }); }
