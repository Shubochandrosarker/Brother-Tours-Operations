import { api } from '@/api/client';
export function listSubmissions(params = {}, signal) { return api.get('/inbox/submissions', { query: { page: params.page || 1, per_page: params.perPage || 20, search: params.search || '', status: params.status || '', form_name: params.formName || '', from: params.from || '', to: params.to || '' }, signal }); }
export function getSubmission(id, signal) { return api.get(`/inbox/submissions/${id}`, { signal }); }
export function setSubmissionStatus(id, status, signal) { return api.post(`/inbox/submissions/${id}/status`, { status }, { signal }); }
export function addSubmissionNote(id, note, tags = '', signal) { return api.post(`/inbox/submissions/${id}/notes`, { note, tags }, { signal }); }
export function replyToSubmission(id, payload, signal) { return api.post(`/inbox/submissions/${id}/reply`, payload, { signal }); }
export function fetchInboxStats(signal) { return api.get('/inbox/stats', { signal }); }
export function listSubscribers(params = {}, signal) { return api.get('/newsletter/subscribers', { query: { page: params.page || 1, per_page: params.perPage || 25, search: params.search || '', status: params.status || '' }, signal }); }
