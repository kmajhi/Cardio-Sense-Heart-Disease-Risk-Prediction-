// Turns the saved assessments (GET /api/history/) into the Dashboard's `risk`
// and `alert`, so the overview shows the latest real estimate, not sample data.
import { buildNotification } from '../../clinical/notifications';
import { timeAgo } from '../../notifications/time';

/** The latest record's grouped alert (see src/clinical/notifications.js), as the Dashboard card. */
function alertFor(record) {
  const n = buildNotification(record);
  if (!n?.groups.length) return null;
  const [first, ...rest] = n.groups;
  const lead = first.findings[0];
  const title = rest.length
    ? `${n.groups.length} areas need attention: ${n.groups.map((g) => g.title.toLowerCase()).join(', ')}`
    : `${first.title}: ${(lead.kind === 'history' ? lead.label : lead.band).toLowerCase()}`;
  return { title, level: n.groups[0].level, href: '/guidance', linkLabel: 'See guidance' };
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
