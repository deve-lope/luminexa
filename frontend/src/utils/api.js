import axios from 'axios';
import { storage } from './helpers';

// Empty string = same-origin (Docker nginx → Django). Unset = local npm default.
// Prefer same-origin whenever the SPA is served from the frontend port or public domain,
// so stale builds that baked localhost:9001 still work in the browser.
function resolveApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    const onFrontendPort = port === '3000' || port === '80' || port === '443' || port === '';
    const onKnownHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('luminex-a.com');
    if (onFrontendPort && onKnownHost) {
      return '';
    }
  }
  if (process.env.REACT_APP_API_URL === '') return '';
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const pageHost = window.location.hostname;
    const onLocalMachine = pageHost === 'localhost' || pageHost === '127.0.0.1';
    // Phone/tablet on LAN: route API via setupProxy.js (same origin :3000).
    if (!onLocalMachine) return '';
  }
  const fallback = process.env.REACT_APP_API_URL || 'http://127.0.0.1:9001';
  if (typeof window === 'undefined') return fallback;
  try {
    const api = new URL(fallback);
    const pageHost = window.location.hostname;
    if (
      (api.hostname === 'localhost' || api.hostname === '127.0.0.1') &&
      pageHost !== 'localhost' &&
      pageHost !== '127.0.0.1'
    ) {
      api.hostname = pageHost;
      return api.origin;
    }
  } catch {
    /* keep fallback */
  }
  return fallback;
}

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // Send HttpOnly auth cookie on same-origin (nginx) and proxied API calls.
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Let the browser set multipart boundary (required for image uploads).
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }
  return config;
});

const PUBLIC_PATH_PREFIXES = [
  '/',
  '/login',
  '/register',
  '/register/business',
  '/forgot-password',
  '/reset-password',
  '/check-email',
  '/verify-email',
  '/accept-staff-invite',
  '/services',
  '/privacy',
  '/privacy-policy',
  '/delete-account',
];

function isPublicPath(pathname) {
  if (PUBLIC_PATH_PREFIXES.includes(pathname)) return true;
  if (pathname.startsWith('/book/')) return true;
  if (pathname.startsWith('/b/')) return true;
  return false;
}

/** Optional callback for global outage UI (registered by ApiHealthProvider). */
let apiHealthHandler = null;

export function registerApiHealthHandler(handler) {
  apiHealthHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (apiHealthHandler === handler) apiHealthHandler = null;
  };
}

api.interceptors.response.use(
  (response) => {
    if (apiHealthHandler) {
      try {
        apiHealthHandler(null);
      } catch {
        /* ignore health handler failures */
      }
    }
    return response;
  },
  (error) => {
    if (apiHealthHandler) {
      try {
        apiHealthHandler(error);
      } catch {
        /* ignore health handler failures */
      }
    }
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const { pathname, search } = window.location;
      if (!isPublicPath(pathname)) {
        storage.remove('token'); // legacy cleanup
        const next = encodeURIComponent(`${pathname}${search}`);
        window.location.assign(`/login?next=${next}`);
      }
    }
    return Promise.reject(error);
  }
);

export const userAPI = {
  getProfile: () => api.get('/accounts/api/profile/'),
  updateProfile: (data) => api.put('/accounts/api/profile/', data),
  login: (credentials) => api.post('/accounts/api/login/', credentials),
  loginStart: (data) => api.post('/accounts/api/login/start/', data),
  requestLoginOtp: (data) => api.post('/accounts/api/login/otp/request/', data),
  verifyLoginOtp: (data) => api.post('/accounts/api/login/otp/verify/', data),
  register: (userData) => api.post('/accounts/api/register/', userData),
  registerBusiness: (userData) => api.post('/accounts/api/register/business/', userData),
  logout: () => api.post('/accounts/api/logout/'),
  completeOnboarding: () => api.post('/accounts/api/onboarding/complete/'),
  requestPasswordReset: (email) => api.post('/accounts/api/password-reset/', { email }),
  confirmPasswordReset: (data) => api.post('/accounts/api/password-reset/confirm/', data),
  verifyEmail: (data) => api.post('/accounts/api/verify-email/', data),
  verifyEmailOtp: (data) => api.post('/accounts/api/verify-email/otp/', data),
  resendVerification: (email) => api.post('/accounts/api/resend-verification/', { email }),
  changePassword: (data) => api.post('/accounts/api/change-password/', data),
  deleteAccount: (data = {}) =>
    api.post('/accounts/api/account/delete/', { confirm: true, ...data }),
  requestAccountDeletion: (email) =>
    api.post('/accounts/api/account/delete/request/', { email }),
  confirmAccountDeletion: (data) => api.post('/accounts/api/account/delete/confirm/', data),
  registerPushToken: (data) => api.post('/accounts/api/push-tokens/', data),
  deletePushToken: (token) =>
    token
      ? api.delete('/accounts/api/push-tokens/', { data: { token } })
      : api.delete('/accounts/api/push-tokens/'),
};

export const businessesAPI = {
  getCustomerHome: () => api.get('/api/v1/customer/home/'),
  discoverServices: (params) =>
    api.get('/api/v1/customer/discover/', {
      params: typeof params === 'string' ? { q: params || undefined } : params,
    }),
  listBookableServices: (params) =>
    api.get('/api/v1/customer/services/', { params }),
  browseServices: (params) => api.get('/api/v1/public/services/', { params }),
  locationOptions: (params) => api.get('/api/v1/location-options/', { params }),
  getMyMemberships: () => api.get('/api/v1/me/memberships/'),
  getPublicStorefront: (slug) => api.get(`/api/v1/public/providers/${slug}/`),
  connectToOrg: (slug) => api.post(`/api/v1/organizations/${slug}/connect/`),
  submitServiceInquiry: (slug, data) =>
    api.post(`/api/v1/organizations/${slug}/service-inquiry/`, data),
  dismissServiceInquiry: (orgSlug, inquiryId) =>
    api.post(`/api/v1/organizations/${orgSlug}/service-inquiries/${inquiryId}/dismiss/`),
  lookupPostalCode: (postal, country) =>
    api.get('/api/v1/postal-lookup/', {
      params: { postal, ...(country ? { country } : {}) },
    }),
  detectAddressCountry: () => api.get('/api/v1/detect-country/'),
  reverseGeocode: ({ lat, lng }) => api.get('/api/v1/reverse-geocode/', { params: { lat, lng } }),
  searchMapLocations: (q, country, config = {}) =>
    api.get('/api/v1/map-search/', {
      ...config,
      params: { q, ...(country ? { country } : {}) },
    }),
  listBusinessTypes: (params) => api.get('/api/v1/business-types/', { params }),
  createBusinessType: (data) => api.post('/api/v1/business-types/', data),
  listProvidersByType: (typeSlug) =>
    api.get(`/api/v1/business-types/${typeSlug}/providers/`),
  getServiceCalendar: (orgSlug, serviceId, params) =>
    api.get(`/api/v1/public/providers/${orgSlug}/services/${serviceId}/calendar/`, {
      params,
    }),
  getCombinedCalendar: (orgSlug, serviceIds, params) =>
    api.get(`/api/v1/public/providers/${orgSlug}/combined-calendar/`, {
      params: {
        services: Array.isArray(serviceIds) ? serviceIds.join(',') : serviceIds,
        ...params,
      },
    }),
  getServiceDetail: (orgSlug, serviceId) =>
    api.get(`/api/v1/public/providers/${orgSlug}/services/${serviceId}/`),
  submitServiceReview: (orgSlug, serviceId, data) =>
    api.post(`/api/v1/public/providers/${orgSlug}/services/${serviceId}/reviews/`, data),
};

export const orgProfileAPI = {
  patchOrganization: (orgSlug, data) => api.patch(`/api/v1/organizations/${orgSlug}/`, data),
  listLocations: (orgSlug) => api.get(`/api/v1/organizations/${orgSlug}/locations/`),
  createLocation: (orgSlug, data) => api.post(`/api/v1/organizations/${orgSlug}/locations/`, data),
  updateLocation: (orgSlug, locationId, data) =>
    api.patch(`/api/v1/organizations/${orgSlug}/locations/${locationId}/`, data),
  deleteLocation: (orgSlug, locationId) =>
    api.delete(`/api/v1/organizations/${orgSlug}/locations/${locationId}/`),
  listGallery: (orgSlug) => api.get(`/api/v1/organizations/${orgSlug}/gallery/`),
  uploadGalleryImage: (orgSlug, formData) =>
    api.post(`/api/v1/organizations/${orgSlug}/gallery/`, formData),
  deleteGalleryImage: (orgSlug, imageId) =>
    api.delete(`/api/v1/organizations/${orgSlug}/gallery/${imageId}/`),
};

export const jobsAPI = {
  getProviderDashboard: (organizationSlug) =>
    api.get('/api/v1/provider-dashboard/', { params: { organization: organizationSlug } }),
  getProviderAnalytics: (organizationSlug, period = 'month') =>
    api.get('/api/v1/provider-analytics/', {
      params: { organization: organizationSlug, period },
    }),
  listBookings: (params) => api.get('/api/v1/bookings/', { params }),
  listMyServiceInquiries: () => api.get('/api/v1/me/service-inquiries/'),
  listMyConversations: () => api.get('/api/v1/me/conversations/'),
  listConversationMessages: (conversationId) =>
    api.get(`/api/v1/conversations/${conversationId}/messages/`),
  sendConversationMessage: (conversationId, body) =>
    api.post(`/api/v1/conversations/${conversationId}/messages/`, { body }),
  listMyNotifications: (params) => api.get('/api/v1/me/notifications/', { params }),
  dismissMyNotification: (notificationId) =>
    api.post(`/api/v1/me/notifications/${notificationId}/dismiss/`),
  dismissAllMyNotifications: () => api.post('/api/v1/me/notifications/dismiss-all/'),
  listProviderServiceRequests: (orgSlug, params) =>
    api.get('/api/v1/provider-service-requests/', { params: { organization: orgSlug, ...params } }),
  getServiceInquiry: (orgSlug, inquiryId) =>
    api.get(`/api/v1/organizations/${orgSlug}/service-inquiries/${inquiryId}/`),
  patchServiceInquiry: (orgSlug, inquiryId, data) =>
    api.patch(`/api/v1/organizations/${orgSlug}/service-inquiries/${inquiryId}/`, data),
  listBookingMessages: (bookingId) => api.get(`/api/v1/bookings/${bookingId}/messages/`),
  sendBookingMessage: (bookingId, body) =>
    api.post(`/api/v1/bookings/${bookingId}/messages/`, { body }),
  listInquiryMessages: (orgSlug, inquiryId) =>
    api.get(`/api/v1/organizations/${orgSlug}/service-inquiries/${inquiryId}/messages/`),
  sendInquiryMessage: (orgSlug, inquiryId, body) =>
    api.post(`/api/v1/organizations/${orgSlug}/service-inquiries/${inquiryId}/messages/`, { body }),
  getBooking: (id) => api.get(`/api/v1/bookings/${id}/`),
  getPublicBooking: (token) => api.get(`/api/v1/public/bookings/${encodeURIComponent(token)}/`),
  getSlot: (id) => api.get(`/api/v1/availability-slots/${id}/`),
  getUnavailableBlock: (id) => api.get(`/api/v1/unavailable-blocks/${id}/`),
  createBooking: (data) => api.post('/api/v1/bookings/', data),
  providerBook: (data) => api.post('/api/v1/bookings/', data),
  requestBooking: (data) => api.post('/api/v1/bookings/', data),
  requestBookingsBatch: (data) => api.post('/api/v1/bookings/batch/', data),
  acceptBooking: (id) => api.post(`/api/v1/bookings/${id}/accept/`),
  sendBookingQuote: (id, data) => api.post(`/api/v1/bookings/${id}/send-quote/`, data),
  askBookingQuoteQuestions: (id, data) =>
    api.post(`/api/v1/bookings/${id}/ask-quote-questions/`, data),
  answerBookingQuoteQuestions: (id, data) =>
    api.post(`/api/v1/bookings/${id}/answer-quote-questions/`, data),
  acceptBookingQuote: (id, data = {}) => api.post(`/api/v1/bookings/${id}/accept-quote/`, data),
  acceptBookingTimeChange: (id) => api.post(`/api/v1/bookings/${id}/accept-time-change/`),
  declineBookingTimeChange: (id) => api.post(`/api/v1/bookings/${id}/decline-time-change/`),
  declineBooking: (id) => api.post(`/api/v1/bookings/${id}/decline/`),
  cancelBooking: (id) => api.post(`/api/v1/bookings/${id}/cancel/`),
  startBooking: (id) => api.post(`/api/v1/bookings/${id}/start/`),
  completeBooking: (id, data = {}) => api.post(`/api/v1/bookings/${id}/complete/`, data),
  getBookingInvoice: (id) => api.get(`/api/v1/bookings/${id}/invoice/`),
  issueBookingInvoice: (id, data) => api.post(`/api/v1/bookings/${id}/invoice/`, data),
  markBookingInvoicePaid: (id) => api.post(`/api/v1/bookings/${id}/invoice/mark-paid/`),
  bookingInvoiceDownloadUrl: (id) => `/api/v1/bookings/${id}/invoice/download/`,
  payBookingInvoice: (id, data = {}) => api.post(`/api/v1/bookings/${id}/invoice/pay/`, data),
  syncBookingInvoicePayment: (id, sessionOrPayload) => {
    const payload =
      typeof sessionOrPayload === 'string'
        ? { session_id: sessionOrPayload }
        : sessionOrPayload || {};
    return api.post(`/api/v1/bookings/${id}/invoice/pay/sync/`, payload);
  },
  getMyUnpaidInvoice: () => api.get('/api/v1/me/unpaid-invoice/'),
  getOrgBilling: (orgSlug) => api.get(`/api/v1/organizations/${orgSlug}/billing/`),
  startConnectOnboarding: (orgSlug, data = {}) =>
    api.post(`/api/v1/organizations/${orgSlug}/billing/connect/onboard/`, data),
  openConnectDashboard: (orgSlug) =>
    api.post(`/api/v1/organizations/${orgSlug}/billing/connect/login/`),
  startSubscription: (orgSlug, data = {}) =>
    api.post(`/api/v1/organizations/${orgSlug}/billing/subscribe/`, data),
  openBillingPortal: (orgSlug, data = {}) =>
    api.post(`/api/v1/organizations/${orgSlug}/billing/portal/`, data),
  redeemPromoCode: (orgSlug, code) =>
    api.post(`/api/v1/organizations/${orgSlug}/billing/redeem-promo/`, { code }),
  syncSubscriptionCheckout: (orgSlug, sessionId) =>
    api.post(`/api/v1/organizations/${orgSlug}/billing/sync-checkout/`, {
      session_id: sessionId,
    }),
  createInstantPayout: (orgSlug, data = {}) =>
    api.post(`/api/v1/organizations/${orgSlug}/billing/instant-payout/`, data),
  connectQuickBooks: (orgSlug) =>
    api.post(`/api/v1/organizations/${orgSlug}/accounting/quickbooks/connect/`),
  disconnectQuickBooks: (orgSlug) =>
    api.post(`/api/v1/organizations/${orgSlug}/accounting/quickbooks/disconnect/`),
  syncQuickBooks: (orgSlug) =>
    api.post(`/api/v1/organizations/${orgSlug}/accounting/quickbooks/sync/`),
  markBookingIncomplete: (id, data = {}) =>
    api.post(`/api/v1/bookings/${id}/incomplete/`, data),
  scheduleReturnVisit: (id, data) =>
    api.post(`/api/v1/bookings/${id}/return-visit/`, data),
  rescheduleBooking: (id, slotId) =>
    api.post(`/api/v1/bookings/${id}/reschedule/`, { slot_id: slotId }),
  markBookingNoShow: (id) => api.post(`/api/v1/bookings/${id}/no-show/`),
  bookingIcalUrl: (id) => `/api/v1/bookings/${id}/ical/`,
  downloadBookingIcal: (id) =>
    api.get(`/api/v1/bookings/${id}/ical/`, { responseType: 'blob' }),
  inviteStaff: (orgSlug, email) =>
    api.post(`/api/v1/organizations/${orgSlug}/invite-staff/`, { email }),
  listStaffInvitations: (orgSlug) =>
    api.get(`/api/v1/organizations/${orgSlug}/staff-invitations/`),
  acceptStaffInvite: (token) => api.post('/api/v1/accept-staff-invite/', { token }),
  listSlots: (params) => api.get('/api/v1/availability-slots/', { params }),
  createSlot: (data) => api.post('/api/v1/availability-slots/', data),
  deleteSlot: (id) => api.delete(`/api/v1/availability-slots/${id}/`),
  listUnavailableBlocks: (params) => api.get('/api/v1/unavailable-blocks/', { params }),
  createUnavailableBlock: (data) => api.post('/api/v1/unavailable-blocks/', data),
  deleteUnavailableBlock: (id) => api.delete(`/api/v1/unavailable-blocks/${id}/`),
  listServiceCategories: (params) => api.get('/api/v1/service-categories/', { params }),
  createServiceCategory: (data) => api.post('/api/v1/service-categories/', data),
  patchServiceCategory: (id, data) => api.patch(`/api/v1/service-categories/${id}/`, data),
  deleteServiceCategory: (id) => api.delete(`/api/v1/service-categories/${id}/`),
  listServices: (params) => api.get('/api/v1/services/', { params }),
  createService: (data) => api.post('/api/v1/services/', data),
  patchService: (id, data) => api.patch(`/api/v1/services/${id}/`, data),
  deleteService: (id) => api.delete(`/api/v1/services/${id}/`),
  listServiceGallery: (serviceId) => api.get(`/api/v1/services/${serviceId}/gallery/`),
  uploadServiceGalleryImage: (serviceId, formData) =>
    api.post(`/api/v1/services/${serviceId}/gallery/`, formData),
  deleteServiceGalleryImage: (serviceId, imageId) =>
    api.delete(`/api/v1/services/${serviceId}/gallery/${imageId}/`),
  listOrgCustomers: (orgSlug, params) =>
    api.get(`/api/v1/organizations/${orgSlug}/customers/`, { params }),
  getOrgCustomer: (orgSlug, userId) =>
    api.get(`/api/v1/organizations/${orgSlug}/customers/${userId}/`),
  patchOrgCustomer: (orgSlug, userId, data) =>
    api.patch(`/api/v1/organizations/${orgSlug}/customers/${userId}/`, data),
  approveCustomer: (orgSlug, userId) =>
    api.post(`/api/v1/organizations/${orgSlug}/approve-customer/`, { user_id: userId }),
  blockCustomer: (orgSlug, userId) =>
    api.post(`/api/v1/organizations/${orgSlug}/block-customer/`, { user_id: userId }),
  unblockCustomer: (orgSlug, userId) =>
    api.post(`/api/v1/organizations/${orgSlug}/unblock-customer/`, { user_id: userId }),
  addBookingCost: (bookingId, data) =>
    api.post(`/api/v1/bookings/${bookingId}/costs/`, data),
  deleteBookingCost: (bookingId, costId) =>
    api.delete(`/api/v1/bookings/${bookingId}/costs/${costId}/`),
  getProviderBooksExportUrl: (organizationSlug, period = 'month') => {
    const base = (api.defaults.baseURL || '').replace(/\/$/, '');
    const q = new URLSearchParams({ organization: organizationSlug, period });
    return `${base}/api/v1/provider-books-export/?${q.toString()}`;
  },
  downloadProviderBooksExport: (organizationSlug, period = 'month') =>
    api.get('/api/v1/provider-books-export/', {
      params: { organization: organizationSlug, period },
      responseType: 'blob',
    }),
  downloadOrganizationDataExport: (organizationSlug, format = 'json') =>
    api.get(`/api/v1/organizations/${organizationSlug}/data-export/`, {
      params: { export_format: format },
      responseType: 'blob',
    }),
  patchOrganization: (orgSlug, data) => api.patch(`/api/v1/organizations/${orgSlug}/`, data),
  getOrganization: (orgSlug) => api.get(`/api/v1/organizations/${orgSlug}/`),
  getWeeklySchedule: (orgSlug) => api.get(`/api/v1/organizations/${orgSlug}/weekly-schedule/`),
  saveWeeklySchedule: (orgSlug, blocks) =>
    api.put(`/api/v1/organizations/${orgSlug}/weekly-schedule/`, blocks),
  getSchedulingSettings: (orgSlug) =>
    api.get(`/api/v1/organizations/${orgSlug}/scheduling-settings/`),
  // Setup / schedule edits: save settings quickly; slot sync may run in background.
  saveSchedulingSettings: (orgSlug, data) =>
    api.put(`/api/v1/organizations/${orgSlug}/scheduling-settings/`, data, { timeout: 30000 }),
  syncRecurringSlots: (orgSlug) =>
    api.post(`/api/v1/organizations/${orgSlug}/sync-recurring-slots/`),
  listProviderConversations: (orgSlug) =>
    api.get(`/api/v1/organizations/${orgSlug}/conversations/`),
  dismissNotification: (orgSlug, notificationId) =>
    api.post(`/api/v1/organizations/${orgSlug}/notifications/${notificationId}/dismiss/`),
  listProviderNotifications: (orgSlug, params) =>
    api.get(`/api/v1/organizations/${orgSlug}/notifications/`, { params }),
  getBookingContext: (orgSlug, { serviceId } = {}) =>
    api.get(`/api/v1/organizations/${orgSlug}/booking-context/`, {
      params: serviceId ? { service: serviceId } : undefined,
    }),
  listTasks: (params) => api.get('/api/v1/tasks/', { params }),
  createTask: (data) => api.post('/api/v1/tasks/', data),
  patchTask: (id, data) => api.patch(`/api/v1/tasks/${id}/`, data),
};

export default api;
