// A fixed copy of what the app shows for one assessment: every value against
// its reference range, the topic alerts, and the personalised recommendations.
// Sent once to the server (PUT /api/history/<id>/guidance/), which checks it and
// keeps it with the assessment, so the PDF report shows exactly this and never
// a different set of advice. Built from the same functions the pages use.
import { describe } from './analyze';
import { GROUPS } from './ranges';
import { buildNotification } from './notifications';
import { recommend } from './recommend';

export const ENGINE = 'cardio-sense-guidance/1';

const finding = (f) => ({
  key: f.key,
  label: f.label,
  kind: f.kind,
  value: f.value ?? null,
  display: f.display ?? '',
  unit: f.unit ?? '',
  range: f.range ?? '',
  level: f.level ?? null,
  band: f.band ?? '',
  status: f.status,
  dir: f.dir ?? null, // which side of the range: 'high' | 'low'
  source: f.source ?? '',
});

/** record: { id, inputs, result }; profile: the Profile page's data or null. */
export function guidanceSnapshot(record, profile = null) {
  const notification = buildNotification(record);
  if (!notification) return null;
  const plan = recommend(notification, profile);
  const { risk, analysis } = notification;
  return {
    engine: ENGINE,
    risk: { level: risk.level, pct: risk.pct, label: risk.label, body: risk.body, note: risk.note },
    urgent: notification.urgent.length > 0,
    missing: analysis.missing,
    findings: analysis.findings.map(finding),
    groups: notification.groups.map((g) => ({
      id: g.id,
      title: GROUPS[g.id].title,
      level: g.level,
      why: GROUPS[g.id].why,
      findings: g.findings.map(describe),
    })),
    sections: plan.sections.map((s) => ({
      id: s.id,
      title: s.title,
      items: s.items.map((it) => ({ id: it.id, text: it.text, because: it.because, source: it.source })),
    })),
    used_profile: plan.usedProfile,
  };
}
