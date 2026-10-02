// Thin fetch wrapper for the Django API. In development the Vite proxy sends
// /api/* to http://localhost:8000 (see vite.config.js), so it's same-origin.
const BASE_URL = '/api';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Fired when the server says the session is over (401), e.g. it expired while
// the page was open. AuthContext listens, signs the page out and sends the
// user to log in, instead of leaving them on "Couldn't load" errors.
export const SESSION_ENDED = 'cardio-sense:session-ended';

// Django sets this cookie (GET /api/auth/me/) and expects it back as a header
// on anything that changes data. It isn't secret from this page, only from others.
function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!SAFE_METHODS.has(method)) headers['X-CSRFToken'] = csrfToken();

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'same-origin', // the session cookie that says who is signed in
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // No answer at all (offline, or the server is down).
    const err = new Error("Can't reach the Cardio Sense server. Check your connection and try again.");
    err.status = 0;
    throw err;
  }

  if (!res.ok) {
    // The backend returns { detail } for invalid input (HTTP 400).
    let detail = '';
    try {
      detail = (await res.json()).detail ?? '';
    } catch {
      /* non-JSON error body */
    }
    // A server-side failure with no explanation (e.g. a proxy error): say what it means.
    const fallback =
      res.status >= 500
        ? 'The Cardio Sense server had a problem or isn’t running. Try again in a moment.'
        : res.status === 403
          ? 'The server refused this request. Refresh the page and try again.'
          : `Request to ${path} failed with status ${res.status}`;
    const err = new Error(detail || fallback);
    err.status = res.status; // callers branch on this, never on the message text
    // /auth/me/ answers 401 by design when signed out; anything else means the session ended.
    if (res.status === 401 && path !== '/auth/me/') window.dispatchEvent(new Event(SESSION_ENDED));
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
