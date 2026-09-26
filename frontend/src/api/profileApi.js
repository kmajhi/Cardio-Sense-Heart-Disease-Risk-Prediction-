import { request } from './client';
import { demoProfile } from '../pages/Profile/demoProfile';

// Mock by default. Same switch as predictionApi.js: set
// VITE_USE_MOCK_API=false in .env.local to call the real endpoints:
//   GET /api/profile/ → profile | 404     PUT /api/profile/ → profile
//   DELETE /api/profile/ → 204
// The mock keeps the profile in this browser's localStorage only, and starts
// from the demo profile once (the backend seeds the same one on migrate).
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

/** Where saved profiles live, for the page's privacy note. */
export const PROFILE_STORAGE = USE_MOCK ? 'browser' : 'server';
const KEY = 'cardio-sense:profile';
const SEEDED_KEY = 'cardio-sense:demo-seeded'; // so a deleted profile stays deleted

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // storage blocked or corrupt: behave like "no profile yet"
  }
}

function writeLocal(profile) {
  try {
    if (profile) localStorage.setItem(KEY, JSON.stringify(profile));
    else localStorage.removeItem(KEY);
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      throw new Error("This browser's storage is full. Try a smaller photo or remove it.");
    }
    throw new Error("This browser won't let the page save data (private mode or storage blocked).");
  }
}

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
  return readLocal() ?? seedOnce();
}

async function seedOnce() {
  try {
    if (localStorage.getItem(SEEDED_KEY)) return null;
    localStorage.setItem(SEEDED_KEY, '1');
  } catch {
    return null; // storage blocked: nowhere to keep it anyway
  }
  const demo = await demoProfile();
  try {
    writeLocal(demo);
  } catch {
    /* shown for this visit even if it can't be kept */
  }
  return demo;
}

/** Creates or replaces the profile; returns what was stored. */
export async function saveProfile(profile) {
  const stored = { ...profile, updated_at: new Date().toISOString() };
  stored.created_at ??= stored.updated_at;
  if (!USE_MOCK) return request('/profile/', { method: 'PUT', body: stored });
  await delay(350);
  writeLocal(stored);
  return stored;
}

export async function deleteProfile() {
  if (!USE_MOCK) {
    await request('/profile/', { method: 'DELETE' });
    return;
  }
  await delay(250);
  writeLocal(null);
}
