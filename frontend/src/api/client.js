// Thin fetch wrapper for the Django API. In development the Vite proxy sends
// /api/* to http://localhost:8000 (see vite.config.js), so it's same-origin.
const BASE_URL = '/api';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Django sets this cookie (GET /api/auth/me/) and expects it back as a header
// on anything that changes data. It isn't secret from this page, only from others.
function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!SAFE_METHODS.has(method)) headers['X-CSRFToken'] = csrfToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'same-origin', // the session cookie that says who is signed in
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    // The backend returns { detail } for invalid input (HTTP 400).
    let detail = '';
    try {
      detail = (await res.json()).detail ?? '';
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(detail || `Request to ${path} failed with status ${res.status}`);
    err.status = res.status; // callers branch on this, never on the message text
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
