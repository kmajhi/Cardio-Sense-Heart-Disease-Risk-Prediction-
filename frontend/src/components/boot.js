// The launch loader plays once per browser session, on whichever page the
// visitor lands first (Home runs its own; components/BootScreen.jsx covers the rest).

export const BOOTED_KEY = 'cardio-sense:booted';

export function alreadyBooted() {
  try {
    return sessionStorage.getItem(BOOTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markBooted() {
  try {
    sessionStorage.setItem(BOOTED_KEY, '1');
  } catch {
    /* storage blocked: the loader just plays again next time */
  }
}
