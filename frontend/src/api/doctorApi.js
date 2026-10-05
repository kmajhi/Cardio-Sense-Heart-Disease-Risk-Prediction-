import { request } from './client';

// The Doctor Panel's API (backend/predictor/doctor_api.py). Doctors only: the
// server checks the role, verification, availability and assignment on every
// call. There is no mock: the panel needs the server.

const qs = (params = {}) => {
  const clean = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false);
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};
const ref = (id) => encodeURIComponent(id);

export const doctorApi = {
  login: (identifier, password) => request('/doctor/login/', { method: 'POST', body: { identifier, password } }),
  me: () => request('/doctor/me/'),
  setAvailable: (isAvailable) => request('/doctor/me/', { method: 'PATCH', body: { is_available: isAvailable } }),
  /** photo: a JPEG data URL (pages/Profile/photo.js), or '' to remove it. */
  setPhoto: (photo) => request('/doctor/me/', { method: 'PATCH', body: { photo } }),
  changePassword: (currentPassword, newPassword) =>
    request('/doctor/password/', { method: 'POST', body: { current_password: currentPassword, new_password: newPassword } }),

  overview: () => request('/doctor/overview/'),
  requests: (params) => request(`/doctor/requests/${qs(params)}`),
  request: (id) => request(`/doctor/requests/${ref(id)}/`),
  claim: (id) => request(`/doctor/requests/${ref(id)}/claim/`, { method: 'POST' }),

  reviews: (params) => request(`/doctor/reviews/${qs(params)}`),
  review: (id) => request(`/doctor/reviews/${ref(id)}/`),
  saveDraft: (id, form) => request(`/doctor/reviews/${ref(id)}/draft/`, { method: 'PUT', body: form }),
  submit: (id, form) => request(`/doctor/reviews/${ref(id)}/submit/`, { method: 'POST', body: form }),
  reportUrl: (id) => `/api/doctor/reviews/${ref(id)}/report/`,
};

/** In-app notifications, for doctors and patients alike (backend/predictor/reviews.py). */
export const notificationsApi = {
  list: () => request('/notifications/'),
  markRead: (ids) => request('/notifications/read/', { method: 'POST', body: ids ? { ids } : {} }),
};
