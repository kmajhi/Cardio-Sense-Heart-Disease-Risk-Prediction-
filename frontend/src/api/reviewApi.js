import { request } from './client';
import { USE_MOCK } from './mode';
import { guidanceSnapshot } from '../clinical/snapshot';
import { addRequest, cancelRequest, loadRequests } from '../pages/AskDoctor/requests';

// A patient's doctor-review requests (backend/predictor/reviews.py).
//
// With the server: a request carries the app's frozen reading of the assessment
// (recorded first, as for the PDF report), so the doctor reviews exactly what
// the patient was shown. In demo mode (no server) requests stay in this
// browser and stay pending: there is no doctor to review them.

export const REVIEWS_LIVE = !USE_MOCK;

/** The demo-mode list in the server's shape. */
function mockRows(account) {
  return loadRequests(account).map((r) => ({
    id: r.id,
    assessment: r.assessment,
    topic: r.topic,
    question: r.question,
    requested_at: r.created_at,
    status: 'pending',
    status_label: 'Pending Doctor Review',
    doctor: null,
    review: null,
    timeline: [{ kind: 'requested', label: 'Review requested', at: r.created_at, by: '' }],
    reports: [],
    demo: true,
  }));
}

/** → the signed-in patient's requests, newest first. */
export function listReviews(account) {
  if (!REVIEWS_LIVE) return Promise.resolve(mockRows(account));
  return request('/reviews/');
}

/** record: { id, inputs, result }; profile: the Profile page's data or null. */
export async function requestReview(account, record, { topic, question }, profile = null) {
  if (!REVIEWS_LIVE) {
    addRequest(account, { assessment: record.id, topic, question });
    return mockRows(account)[0];
  }
  await request(`/history/${encodeURIComponent(record.id)}/guidance/`, {
    method: 'PUT',
    body: { guidance: guidanceSnapshot(record, profile) },
  });
  return request('/reviews/', { method: 'POST', body: { assessment: record.id, topic, question } });
}

/** Withdraw a request no doctor has accepted yet. */
export function withdrawReview(account, id) {
  if (!REVIEWS_LIVE) {
    cancelRequest(account, id);
    return Promise.resolve(null);
  }
  return request(`/reviews/${encodeURIComponent(id)}/`, { method: 'DELETE' });
}
