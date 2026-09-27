import { request } from './client';
import { readForAccount, writeForAccount } from './mockStore';

// The signed-in user's profile. Mock by default. Same switch as predictionApi.js:
// set VITE_USE_MOCK_API=false in .env.local to call the real endpoints:
//   GET /api/profile/ → profile | 404     PUT /api/profile/ → profile
//   DELETE /api/profile/ → 204
// The mock keeps each account's profile in this browser's localStorage.
// A new account has none, until they create it.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

/** Where saved profiles live, for the page's privacy note. */
export const PROFILE_STORAGE = USE_MOCK ? 'browser' : 'server';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The signed-in user's profile, or null if they haven't made one. */
export async function getProfile() {
  if (!USE_MOCK) {
    try {
      return await request('/profile/');
    } catch (err) {
      if (err.status === 404) return null; // "No profile yet."
      throw err;
    }
  }
  return readForAccount('profile', null);
}

/** Creates or replaces the profile; returns what was stored. */
export async function saveProfile(profile) {
  const stored = { ...profile, updated_at: new Date().toISOString() };
  stored.created_at ??= stored.updated_at;
  if (!USE_MOCK) return request('/profile/', { method: 'PUT', body: stored });
  await delay(350);
  writeForAccount('profile', stored);
  return stored;
}

export async function deleteProfile() {
  if (!USE_MOCK) {
    await request('/profile/', { method: 'DELETE' });
    return;
  }
  await delay(250);
  writeForAccount('profile', null);
}
