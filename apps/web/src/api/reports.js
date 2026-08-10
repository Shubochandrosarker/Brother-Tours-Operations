import { api } from '@/api/client';
export function fetchOverviewReport(params = {}, signal) { return api.get('/reports/overview', { query: params, signal }); }
export function fetchBookingsReport(params = {}, signal) { return api.get('/reports/bookings', { query: params, signal }); }
export function fetchFormsReport(signal) { return api.get('/reports/forms', { signal }); }
