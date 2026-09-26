import { request } from './client';

// Linked accounts. With the Django API (VITE_USE_MOCK_API=false) connecting is
// real OAuth: the page navigates to /api/connect/<id>/start/, the provider's own
// sign-in page asks the user, and the server sends them back to
// /profile?connected=<id> or ?connect_error=<code> (see backend/predictor/connections.py).
// The mock (static deploy, no server) keeps the old simulated flow.
export const REAL_OAUTH = import.meta.env.VITE_USE_MOCK_API === 'false';

/** { gmail: true, x: false, ... }: which providers have app keys on the server. */
export function getProviders() {
  return REAL_OAUTH ? request('/connect/') : Promise.resolve({});
}

/** Leaves the page for the provider's authorize screen. */
export function startConnect(id) {
  window.location.assign(`/api/connect/${encodeURIComponent(id)}/start/`);
}

const ERRORS = {
  denied: (name) => `You cancelled the ${name} sign-in, so nothing was linked.`,
  expired: () => 'That sign-in expired or was opened twice. Try connecting again.',
  not_configured: (name) => `${name} sign-in isn't set up on the server yet.`,
  no_profile: () => 'Create your profile first, then connect accounts.',
  failed: (name) => `${name} didn't confirm the account. Try again in a moment.`,
};

/** The result the OAuth callback left in the URL → { ok, id, message } | null. Pure: safe to call twice. */
export function readConnectResult(nameOf) {
  const params = new URLSearchParams(window.location.search);
  const connected = params.get('connected');
  const error = params.get('connect_error');
  const provider = params.get('provider');
  if (connected) return { ok: true, id: connected, message: `${nameOf(connected)} connected.` };
  if (!error) return null;
  const name = nameOf(provider) || 'The account';
  return { ok: false, id: provider, message: (ERRORS[error] ?? ERRORS.failed)(name) };
}

/** Removes that result from the URL, so a reload doesn't repeat the message. */
export function clearConnectResult() {
  const params = new URLSearchParams(window.location.search);
  ['connected', 'connect_error', 'provider'].forEach((key) => params.delete(key));
  const rest = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
}
