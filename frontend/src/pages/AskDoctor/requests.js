// Ask a Doctor requests, demo phase: kept in this browser only, per account.
// There is no doctor side yet, so every request stays "pending". A future
// review system replaces this file with API calls (and fills the PDF report's
// Doctor's Clinical Review section, backend/predictor/reports.py).

const KEY = (account) => `cardio-sense:doctor-requests:${account || 'guest'}`;
export const MAX_QUESTION = 1000;

export const TOPICS = [
  { id: 'result', label: 'Understand my result' },
  { id: 'tests', label: 'My test values' },
  { id: 'lifestyle', label: 'Diet & lifestyle' },
  { id: 'medicine', label: 'Medicines' },
  { id: 'other', label: 'Something else' },
];

/** → [{ id, assessment, topic, question, created_at, status }], newest first. */
export function loadRequests(account) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY(account)) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(account, list) {
  try {
    localStorage.setItem(KEY(account), JSON.stringify(list));
  } catch {
    /* private window or storage full: the request still shows until reload */
  }
  return list;
}

/** Adds a pending request and returns the new list. */
export function addRequest(account, { assessment, topic, question }, now = new Date()) {
  const request = {
    id: `Q-${now.getTime().toString(36).toUpperCase()}`,
    assessment,
    topic,
    question: question.trim().slice(0, MAX_QUESTION),
    created_at: now.toISOString(),
    status: 'pending',
  };
  return save(account, [request, ...loadRequests(account)]);
}

/** Withdraws a request and returns the new list. */
export function cancelRequest(account, id) {
  return save(account, loadRequests(account).filter((r) => r.id !== id));
}
