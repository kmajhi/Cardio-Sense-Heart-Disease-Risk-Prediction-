// Thin fetch wrapper for the Django API. In development the Vite proxy sends
// /api/* to http://localhost:8000 (see vite.config.js).
const BASE_URL = '/api';

export async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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
    throw new Error(detail || `Request to ${path} failed with status ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}
