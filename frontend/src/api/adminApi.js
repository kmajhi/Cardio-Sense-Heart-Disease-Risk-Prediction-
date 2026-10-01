import { request } from './client';

// The admin console's API (backend/predictor/admin_api.py). Staff only; the
// server checks every call. There is no mock: the console needs the server.

const qs = (params = {}) => {
  const clean = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false);
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};

export const admin = {
  overview: () => request('/admin/overview/'),

  users: (params) => request(`/admin/users/${qs(params)}`),
  user: (id) => request(`/admin/users/${id}/`),
  updateUser: (id, body) => request(`/admin/users/${id}/`, { method: 'PATCH', body }),
  deleteUser: (id) => request(`/admin/users/${id}/`, { method: 'DELETE' }),
  sendReset: (id) => request(`/admin/users/${id}/send-reset/`, { method: 'POST' }),
  signOutUser: (id) => request(`/admin/users/${id}/sign-out/`, { method: 'POST' }),

  assessments: (params) => request(`/admin/assessments/${qs(params)}`),
  assessment: (ref) => request(`/admin/assessments/${ref}/`),
  saveNotes: (ref, notes) => request(`/admin/assessments/${ref}/`, { method: 'PATCH', body: { notes } }),
  deleteAssessment: (ref) => request(`/admin/assessments/${ref}/`, { method: 'DELETE' }),

  model: () => request('/admin/model/'),
  checkModel: () => request('/admin/model/check/', { method: 'POST' }),
  testModel: (body) => request('/admin/model/test/', { method: 'POST', body }),
  reloadModel: () => request('/admin/model/reload/', { method: 'POST' }),

  activity: (params) => request(`/admin/activity/${qs(params)}`),
  system: () => request('/admin/system/'),
  maintenance: () => request('/admin/maintenance/'),
  runTask: (task) => request(`/admin/maintenance/${task}/`, { method: 'POST' }),
  settings: () => request('/admin/settings/'),
  saveSettings: (body) => request('/admin/settings/', { method: 'PATCH', body }),
};

/** Downloads a file the API serves (CSV export, JSON backup) with the signed-in session. */
export async function download(path, params, fallbackName) {
  const res = await fetch(`/api${path}${qs(params)}`, { credentials: 'same-origin' });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).detail ?? '';
    } catch {
      /* not JSON */
    }
    throw new Error(detail || `Download failed (${res.status}).`);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Site banner and switches, for every visitor: GET /api/site/. */
export const siteStatus = () => request('/site/');
