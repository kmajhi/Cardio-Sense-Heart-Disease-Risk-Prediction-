// Ask a Doctor requests in demo mode (no server): kept in this browser only,
// per account, and always "pending" since no doctor can see them. With the
// server, api/reviewApi.js sends them to the doctors' review queue instead.

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

/**
 * The patient's review timeline, from the request's recorded events: steps that
 * happened carry their time (`when`), later ones are null.
 */
export function reviewSteps(r, assessmentDate) {
  const at = (kind) => r.timeline?.find((e) => e.kind === kind)?.at ?? null;
  const done = r.status === 'completed';
  return [
    ['Assessment completed', assessmentDate ?? null],
    ['Doctor review requested', at('requested') ?? r.requested_at ?? null],
    ['Doctor assigned', at('claimed') ?? r.claimed_at ?? null],
    ['Currently under review', at('opened') ?? at('claimed') ?? r.claimed_at ?? null],
    ['Doctor review completed', at('submitted') ?? r.completed_at ?? null],
    ['Updated report available', done ? at('report_updated') ?? r.completed_at ?? null : null],
  ].map(([label, when]) => ({ label, when }));
}
