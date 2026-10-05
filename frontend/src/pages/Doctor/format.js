// Plain helpers for the Doctor Panel, kept out of the component files so Fast
// Refresh keeps working and they can be unit-tested.
import { GROUPS, GROUP_ORDER, MEASURES, HISTORY, BMI } from '../../clinical/ranges';
import { RISK, pctText } from '../../clinical/risk';

export const SEX = { M: 'Male', F: 'Female' };

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "04 Oct 2026" */
export const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '—');
/** "04 Oct 2026 · 09:42" */
export const fmtDateTime = (iso) => (iso ? `${dateFmt.format(new Date(iso))} · ${timeFmt.format(new Date(iso))}` : '—');
/** "10:42" */
export const fmtTime = (iso) => (iso ? timeFmt.format(new Date(iso)) : '');

/** "48 years · Male" from what the assessment recorded; never guessed. */
export function patientLine(p) {
  const parts = [];
  if (p?.age || p?.age === 0) parts.push(`${p.age} years`);
  if (SEX[p?.sex]) parts.push(SEX[p.sex]);
  return parts.join(' · ') || 'Age and sex not recorded';
}

/** "52% · Moderate" */
export function riskLine(risk) {
  if (!risk) return '—';
  const label = RISK[risk.level]?.label.replace(' risk', '') ?? risk.level;
  return `${pctText(risk.probability)}% · ${label}`;
}

export const RISK_TONE = { low: 'ok', moderate: 'warn', high: 'alert' };

/** Status → tone for the badge; the label always says it in words too. */
export const STATUS_TONE = {
  pending: 'warn',
  under_review: 'info',
  completed: 'ok',
  cancelled: 'muted',
};

export const DECISIONS = [
  { id: 'reviewed', label: 'Reviewed — No Additional Action' },
  { id: 'approved', label: 'Approved' },
  { id: 'approved_with_recommendations', label: 'Approved with Recommendations' },
  { id: 'follow_up_required', label: 'Follow-up Required' },
  { id: 'needs_more_information', label: 'More Information Required' },
  { id: 'further_evaluation', label: 'Further Evaluation Recommended' },
];
// Must match ClinicalReview.NEEDS_ACTION_PLAN (backend/predictor/models.py).
export const NEEDS_ACTION_PLAN = new Set([
  'approved_with_recommendations',
  'follow_up_required',
  'needs_more_information',
  'further_evaluation',
]);

/** The first thing missing before a final submission, or '' (the server checks the same). */
export function missingForSubmit(form) {
  if (!form.decision) return 'Select a review decision.';
  if (!form.remarks.trim()) return 'Enter your clinical remarks.';
  if (NEEDS_ACTION_PLAN.has(form.decision) && !form.action_plan.trim()) {
    const label = DECISIONS.find((d) => d.id === form.decision)?.label;
    return `Add a clinical action plan for “${label}”.`;
  }
  return '';
}

/**
 * A finding's status in words, from the app's own grading (clinical/analyze.js),
 * the same wording as the PDF report: an arrow and "high"/"low", never colour alone.
 * → { text, tone }
 */
export function findingStatus(f) {
  if (!f) return { text: '—', tone: 'muted' };
  if (f.status === 'missing') return { text: 'Not measured', tone: 'muted' };
  if (f.status === 'uncertain') return { text: 'Unclear (censored result)', tone: 'muted' };
  if (f.kind === 'history') return f.status === 'flagged' ? { text: 'Reported', tone: 'warn' } : { text: 'Not reported', tone: 'muted' };
  const side = f.dir === 'high' ? 'high' : f.dir === 'low' ? 'low' : '';
  const arrow = side === 'high' ? '↑ ' : side === 'low' ? '↓ ' : '';
  switch (f.level) {
    case 'normal':
      return { text: 'Within range', tone: 'ok' };
    case 'elevated':
      return { text: `${arrow}${side ? `Mildly ${side}` : 'Borderline'}`, tone: 'warn' };
    case 'high':
      return { text: `${arrow}${side ? side[0].toUpperCase() + side.slice(1) : 'Outside range'}`, tone: 'alert' };
    case 'urgent':
      return { text: `${arrow}Prompt attention${side ? ` (${side})` : ''}`, tone: 'alert' };
    default:
      return { text: '—', tone: 'muted' };
  }
}

const GROUP_OF = Object.fromEntries([
  ...MEASURES.map((m) => [m.key, m.group]),
  ...HISTORY.map((h) => [h.key, h.group]),
  [BMI.key, BMI.group],
  ['troponin_i', 'cardiac'],
]);

// Titles for the measurement table, in the order a lab sheet lists them.
const TABLE_GROUPS = [
  ['weight', 'Anthropometric'],
  ['bp', 'Blood pressure'],
  ['glucose', 'Glucose / metabolic'],
  ['lipids', 'Lipid profile'],
  ['kidney', 'Renal function'],
  ['electrolytes', 'Electrolytes'],
  ['blood', 'Hematology'],
  ['cardiac', 'Cardiac markers'],
];

/**
 * The frozen guidance's measured findings grouped for the parameter table:
 * [{ id, title, rows: [finding] }]. Only what the assessment recorded; no
 * value, unit or range is ever filled in here.
 */
export function groupMeasurements(findings = []) {
  const measured = findings.filter((f) => f.kind !== 'history');
  return TABLE_GROUPS.map(([id, title]) => ({
    id,
    title,
    rows: measured.filter((f) => (GROUP_OF[f.key] ?? 'other') === id),
  })).filter((g) => g.rows.length);
}

/** The reported history items (yes / no / not answered) from the saved inputs. */
export function historyItems(inputs = {}) {
  return HISTORY.map((h) => {
    const raw = inputs[h.key];
    const value = raw === null || raw === undefined || raw === '' ? 'Not answered' : String(raw) === '1' ? 'Yes' : 'No';
    return { key: h.key, label: h.label, value };
  });
}

/** Flagged findings, most serious first: the "Key findings" panel. */
export function keyFindings(findings = [], limit = 6) {
  const order = { urgent: 0, high: 1, elevated: 2 };
  return findings
    .filter((f) => f.status === 'flagged' && f.kind !== 'history')
    .sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3) || GROUP_ORDER.indexOf(GROUP_OF[a.key]) - GROUP_ORDER.indexOf(GROUP_OF[b.key]))
    .slice(0, limit);
}

export const groupTitle = (id) => GROUPS[id]?.title ?? id;

/** "Good morning" / "Good afternoon" / "Good evening" for the doctor's own clock. */
export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** "Dr. Sarah Rahman" without doubling a title someone typed into their name. */
export const drName = (name = '') => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

/** Repeated "Draft saved" events shown once, as the latest, with how many times. */
export function compactTimeline(events = []) {
  const out = [];
  for (const e of events) {
    const last = out.at(-1);
    if (e.kind === 'draft_saved' && last?.kind === 'draft_saved') {
      out[out.length - 1] = { ...e, label: `Draft saved (${(last.times ?? 1) + 1} times)`, times: (last.times ?? 1) + 1 };
    } else out.push(e);
  }
  return out;
}
