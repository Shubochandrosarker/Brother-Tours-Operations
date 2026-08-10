import { api } from '@/api/client';
export function fetchInquiries(params = {}, signal) {
  const query = {
    page: params.page || 1,
    per_page: params.perPage || 25,
    search: params.search || '',
    type: params.type || '',
    status: params.status || '',
    portal_status: params.workflow || '',
    assigned_to: params.assignedTo || '',
    tour_id: params.tourId || '',
    from: params.from || '',
    to: params.to || '',
    orderby: params.orderby || 'id',
    order: (params.order || 'DESC').toUpperCase(),
  };
  return api.get('/bookings', { query, signal });
}
export function fetchInquiry(id, signal) { return api.get(`/bookings/${id}`, { signal }); }
export function fetchInquiryActions(id, signal) { return api.get(`/bookings/${id}/actions`, { signal }); }
export function setBookingWorkflow(id, status, signal) { return api.post(`/bookings/${id}/workflow`, { status }, { signal }); }
export function assignBookingStaff(id, userId, signal) { return api.post(`/bookings/${id}/assign`, { userId: Number(userId) || 0 }, { signal }); }
export function addBookingNote(id, note, signal) { return api.post(`/bookings/${id}/note`, { note }, { signal }); }
export function triggerBookingLifecycle(id, action, signal) { return api.post(`/bookings/${id}/lifecycle`, { action }, { signal }); }
export function createPaymentLink(id, gateway, type, signal) { return api.post(`/bookings/${id}/payment-link`, { gateway, type }, { signal }); }
export function dispatchBooking(id, event, signal) { return api.post(`/bookings/${id}/dispatch`, { event }, { signal }); }
