import { request } from './client';
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
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

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
  if (accounts[key]) throw new Error('An account with this email already exists. Log in instead.');
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
