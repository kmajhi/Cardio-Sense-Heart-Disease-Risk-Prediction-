import { request } from './client';
import { USE_MOCK } from './mode';
import { readForAccount, writeForAccount } from './mockStore';

// The signed-in user's saved assessments: GET /api/history/ (every POST
// /api/predict/ they made). Mock unless VITE_USE_MOCK_API=false, in which case
// they're kept per account in this browser. A new account has none.

// Several parts of a page ask for the history as it opens (the page itself and
// the notifications bell). While one request is in flight, the others share it.
let inflight = null;

/** [{ id, created_at, inputs, result }], oldest first. */
export function getHistory() {
  if (!USE_MOCK) {
    inflight ??= request('/history/').finally(() => {
      inflight = null;
    });
    return inflight;
  }
  try {
    return Promise.resolve(readForAccount('history', []));
  } catch (err) {
    return Promise.reject(err);
  }
}

/** Mock mode: keep a prediction, as the real POST /api/predict/ does. */
export function saveMockRecord(inputs, result) {
  const records = readForAccount('history', []);
  const last = Number(records.at(-1)?.id?.slice(2)) || 0;
  const record = { id: `A-${String(last + 1).padStart(4, '0')}`, created_at: new Date().toISOString(), inputs, result };
  writeForAccount('history', [...records, record]);
  return record;
}
