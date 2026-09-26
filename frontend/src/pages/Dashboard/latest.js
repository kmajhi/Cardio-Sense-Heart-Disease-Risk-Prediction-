// Turns the saved assessments (GET /api/history/) into the Dashboard's `risk`
// and `alert`, so the overview shows the latest real estimate, not sample data.
import { TESTS, reading, status } from '../History/tests';

/** "just now", "5 min ago", "3 h ago", "2 days ago", or a date. */
export function timeAgo(iso, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return `on ${new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** The first test of the latest record outside its typical range, as an alert. */
function alertFor(record) {
  for (const test of TESTS) {
    const st = status(reading(test, record.inputs));
    if (st === 'high' || st === 'low') {
      return { title: `${test.label} is ${st === 'high' ? 'above' : 'below'} the typical range`, href: '/history' };
    }
  }
  return null;
}

/** { risk, alert } for the Dashboard, or { risk: null } when nothing has been assessed yet. */
export function fromHistory(records) {
  const latest = records?.at(-1);
  if (!latest) return { risk: null, alert: null };
  const { probability, risk_level, top_factors = [] } = latest.result;
  return {
    risk: {
      probability,
      level: risk_level,
      id: latest.id,
      updatedLabel: timeAgo(latest.created_at),
      // Only what pushed the estimate up: those are the ones worth acting on.
      factors: top_factors.filter((f) => f.contribution > 0).slice(0, 3).map((f) => f.name),
    },
    alert: alertFor(latest),
  };
}
