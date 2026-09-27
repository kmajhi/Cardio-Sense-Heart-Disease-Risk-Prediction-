// Mock mode only (VITE_USE_MOCK_API not "false"): this browser's localStorage
// stands in for the server. Like the real API, every account's data is kept
// apart, under a key ending in its email, and a new account starts empty.

export const SESSION_KEY = 'cardio-sense:session'; // the signed-in account's email

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback; // storage blocked or corrupt
  }
}

export function writeJson(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      throw new Error("This browser's storage is full. Try a smaller photo or remove it.");
    }
    throw new Error("This browser won't let the page save data (private mode or storage blocked).");
  }
}

/** The signed-in account's email, or null. */
export const mockAccount = () => readJson(SESSION_KEY, null);

function accountKey(name) {
  const email = mockAccount();
  if (!email) {
    const err = new Error('Log in to continue.');
    err.status = 403; // what the real API answers when signed out
    throw err;
  }
  return `cardio-sense:${name}:${email}`;
}

/** This account's `name` data (e.g. 'history', 'profile'). */
export const readForAccount = (name, fallback) => readJson(accountKey(name), fallback);

export const writeForAccount = (name, value) => writeJson(accountKey(name), value);
