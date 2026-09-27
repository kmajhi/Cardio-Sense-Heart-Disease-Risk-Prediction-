import { request } from './client';
import { readForAccount, writeForAccount } from './mockStore';

// The signed-in user's saved assessments: GET /api/history/ (every POST
// /api/predict/ they made). Mock unless VITE_USE_MOCK_API=false, in which case
// they're kept per account in this browser. A new account has none.
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

/** [{ id, created_at, inputs, result }], oldest first. */
export function getHistory() {
  if (!USE_MOCK) return request('/history/');
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
