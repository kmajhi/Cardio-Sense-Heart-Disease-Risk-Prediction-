import { request } from './client';
import { USE_MOCK } from './mode';
import { SESSION_KEY, readJson as read, writeJson as write } from './mockStore';

// Django's accounts (backend/predictor/accounts.py), signed in with a session cookie:
//   POST /api/auth/register/ { name, email, password } → user | 400 { detail }
//   POST /api/auth/login/    { email, password }       → user | 400 { detail }
//   POST /api/auth/logout/                             → 204
//   GET  /api/auth/me/                                 → user | 401
// where user is { name, email }.
// Same switch as the other APIs: mock unless VITE_USE_MOCK_API=false. The mock
// keeps accounts in this browser's localStorage (passwords as salted SHA-256
// hashes, never in plain text). It's for trying the app, not security.

const ACCOUNTS_KEY = 'cardio-sense:accounts';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normEmail = (email) => email.trim().toLowerCase();

async function hash(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const publicUser = ({ name, email }) => ({ name, email });

/** The signed-in user, or null. */
export async function currentUser() {
  if (!USE_MOCK) {
    try {
      return await request('/auth/me/');
    } catch (err) {
      if (err.status === 401 || err.status === 403) return null;
      throw err;
    }
  }
  const email = read(SESSION_KEY, null);
  const account = email && read(ACCOUNTS_KEY, {})[email];
  return account ? publicUser(account) : null;
}

export async function register({ name, email, password }) {
  if (!USE_MOCK) return request('/auth/register/', { method: 'POST', body: { name, email, password } });
  await delay(600);
  const key = normEmail(email);
  const accounts = read(ACCOUNTS_KEY, {});
  if (accounts[key]) throw new Error("We couldn't create an account with that email. If you already have one, log in or reset your password.");
  const salt = crypto.randomUUID();
  const account = { name: name.trim(), email: key, salt, hash: await hash(password, salt) };
  write(ACCOUNTS_KEY, { ...accounts, [key]: account });
  write(SESSION_KEY, key);
  return publicUser(account);
}

export async function login({ email, password }) {
  if (!USE_MOCK) return request('/auth/login/', { method: 'POST', body: { email, password } });
  await delay(600);
  const key = normEmail(email);
  const account = read(ACCOUNTS_KEY, {})[key];
  // One message for both cases, so the form doesn't reveal which emails have accounts.
  if (!account || account.hash !== (await hash(password, account.salt))) {
    throw new Error('Incorrect email or password.');
  }
  write(SESSION_KEY, key);
  return publicUser(account);
}

export async function logout() {
  if (!USE_MOCK) {
    await request('/auth/logout/', { method: 'POST' });
    return;
  }
  write(SESSION_KEY, null);
}

// ---------- Password and data rights ----------
//   POST   /api/auth/password/                { current_password, new_password } → 204
//   POST   /api/auth/password-reset/          { email }                          → 204 (always)
//   POST   /api/auth/password-reset/confirm/  { uid, token, password }           → 204
//   GET    /api/auth/export/                  → everything stored about the user
//   DELETE /api/auth/account/                 { password }                       → 204

async function mockAccountFor(password) {
  const email = read(SESSION_KEY, null);
  const accounts = read(ACCOUNTS_KEY, {});
  const account = email && accounts[email];
  if (!account) throw Object.assign(new Error('Log in to continue.'), { status: 401 });
  if (account.hash !== (await hash(password, account.salt))) throw new Error('Your password is incorrect.');
  return { email, accounts, account };
}

export async function changePassword({ currentPassword, newPassword }) {
  if (!USE_MOCK) {
    await request('/auth/password/', {
      method: 'POST',
      body: { current_password: currentPassword ?? '', new_password: newPassword },
    });
    return;
  }
  await delay(400);
  if (newPassword.length < 8) throw new Error('This password is too short. It must contain at least 8 characters.');
  const { email, accounts, account } = await mockAccountFor(currentPassword).catch((err) => {
    throw err.status ? err : new Error('Your current password is incorrect.');
  });
  const salt = crypto.randomUUID();
  write(ACCOUNTS_KEY, { ...accounts, [email]: { ...account, salt, hash: await hash(newPassword, salt) } });
}

/** Emails a reset link if the address has an account. Says nothing either way. */
export async function requestPasswordReset(email) {
  if (!USE_MOCK) {
    await request('/auth/password-reset/', { method: 'POST', body: { email } });
    return;
  }
  throw new Error('Password reset needs the Cardio Sense server: demo mode has no email. Create a new demo account instead.');
}

export async function confirmPasswordReset({ uid, token, password }) {
  await request('/auth/password-reset/confirm/', { method: 'POST', body: { uid, token, password } });
}

/** Everything stored about the signed-in user, as a JSON-ready object. */
export async function exportData() {
  if (!USE_MOCK) return request('/auth/export/');
  const email = read(SESSION_KEY, null);
  const account = email && read(ACCOUNTS_KEY, {})[email];
  if (!account) throw Object.assign(new Error('Log in to continue.'), { status: 401 });
  return {
    exported_at: new Date().toISOString(),
    account: publicUser(account),
    profile: read(`cardio-sense:profile:${email}`, null),
    assessments: read(`cardio-sense:history:${email}`, []),
  };
}

/**
 * Deletes the account and everything in it, then signs out. Confirmed with the
 * password, or, for an account made with Google or X sign-in, by typing DELETE.
 */
export async function deleteAccount({ password = '', confirm = '' } = {}) {
  if (!USE_MOCK) {
    await request('/auth/account/', { method: 'DELETE', body: { password, confirm } });
    return;
  }
  await delay(400);
  const { email, accounts } = await mockAccountFor(password);
  const { [email]: _gone, ...rest } = accounts;
  write(ACCOUNTS_KEY, rest);
  write(`cardio-sense:profile:${email}`, null);
  write(`cardio-sense:history:${email}`, null);
  write(SESSION_KEY, null);
}

// ---------- Sign in with Google or X ----------
// The server runs the provider's sign-in (backend/predictor/social_login.py)
// and comes back to /dashboard, or to /?auth=login&auth_error=<code>&provider=<id>.

export const SIGN_IN_PROVIDERS = [
  { id: 'gmail', name: 'Google' },
  { id: 'x', name: 'X' },
];

const providerName = (id) => SIGN_IN_PROVIDERS.find((p) => p.id === id)?.name ?? 'That provider';

const SIGN_IN_ERRORS = {
  denied: (name) => `You cancelled the ${name} sign-in.`,
  expired: () => 'That sign-in expired or was opened twice. Try again.',
  not_configured: (name) => `${name} sign-in isn't set up on the server yet. Use your email and password for now.`,
  email_exists: () =>
    'An account with this email already exists. Log in with its password (or reset it), and you can use that account as before.',
  no_email: (name) => `${name} didn't share a verified email address, so we couldn't create your account.`,
  failed: (name) => `Couldn't sign you in with ${name}. Try again in a moment.`,
};

/** The message for an auth_error code the server sent back. */
export const signInErrorMessage = (code, provider) => (SIGN_IN_ERRORS[code] ?? SIGN_IN_ERRORS.failed)(providerName(provider));

/** Leaves the page for the provider's sign-in. */
export function signInWith(provider) {
  window.location.assign(`/api/auth/oauth/${encodeURIComponent(provider)}/start/`);
}
