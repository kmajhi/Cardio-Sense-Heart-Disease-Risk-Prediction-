import { request } from './client';
import { USE_MOCK } from './mode';
import { guidanceSnapshot } from '../clinical/snapshot';

// The PDF Heart Health Assessment Report for one saved assessment
// (backend/predictor/reports.py). The server builds it from that assessment's
// stored values and saved result; the model is not run again. Needs the real
// server: in demo mode nothing is stored server-side.

export const REPORTS_AVAILABLE = !USE_MOCK;

/**
 * record: { id: 'A-0012', inputs, result }; profile: the Profile page's data or null.
 * Records the app's analysis and recommendations for the assessment (kept from the
 * first time only, so the report matches what was shown), then downloads the PDF.
 * → { name, handedOff }: handedOff when a download manager took the file over.
 */
export async function downloadReport(record, profile = null) {
  if (!REPORTS_AVAILABLE) throw new Error('PDF reports need the Cardio Sense server: they aren’t available in demo mode.');
  if (!record?.id) throw new Error('This estimate hasn’t been saved, so there is no report for it.');
  const ref = encodeURIComponent(record.id);
  await request(`/history/${ref}/guidance/`, { method: 'PUT', body: { guidance: guidanceSnapshot(record, profile) } });

  let res;
  try {
    res = await fetch(`/api/history/${ref}/report/`, { credentials: 'same-origin' });
  } catch {
    throw new Error("Can't reach the Cardio Sense server. Check your connection and try again.");
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).detail ?? '';
    } catch {
      /* not JSON */
    }
    throw new Error(detail || `The report couldn’t be created (error ${res.status}). Try again in a moment.`);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `cardio-sense-report-${record.id}.pdf`;
  const blob = await res.blob();
  // Download managers (e.g. IDM's browser extension) take PDF responses away from
  // the page and hand it an empty one. Then let the browser follow a plain link
  // instead (same origin, so the session cookie goes with it), which they handle.
  if (res.status === 204 || blob.size === 0 || !/pdf/i.test(res.headers.get('Content-Type') ?? '')) {
    save(`/api/history/${ref}/report/`, name);
    return { name, handedOff: true };
  }
  const url = URL.createObjectURL(blob);
  save(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { name, handedOff: false };
}

function save(href, name) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}
