// Turns the signed-in user's saved assessments (GET /api/history/) into the
// Dashboard's data. Everything on it comes from their own records: a new
// account sees empty states until their first prediction.
import { buildNotification } from '../../clinical/notifications';
import { timeAgo } from '../../notifications/time';

/** The latest record's grouped alert (see src/clinical/notifications.js), as the Dashboard card. */
function alertFor(record) {
  const n = buildNotification(record);
  if (!n?.groups.length) return null;
  const [first, ...rest] = n.groups;
  const lead = first.findings[0];
  // A short headline; the areas go on a smaller line under it.
  const title = rest.length
    ? `${n.groups.length} areas need attention`
    : `${first.title}: ${(lead.kind === 'history' ? lead.label : lead.band).toLowerCase()}`;
  const detail = rest.length ? n.groups.map((g) => g.title).join(' · ') : null;
  return { title, detail, level: n.groups[0].level, href: '/guidance', linkLabel: 'See guidance' };
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

/** The pill above the panel: how many assessments, and the last few risk levels as bars. */
function recoveryFrom(records) {
  if (!records.length) return null;
  return {
    label: 'Your assessments',
    value: `${records.length} saved`,
    bars: records.slice(-6).map((r) => Math.max(0.12, r.result.probability)),
  };
}

/** The Dashboard's `data` for a signed-in user (dashboardMock.js documents the shape). */
export function dashboardFrom(records = []) {
  const { risk, alert } = fromHistory(records);
  return {
    risk,
    alert,
    hasNotifications: Boolean(alert),
    recovery: recoveryFrom(records),
    recent: records,
  };
}
