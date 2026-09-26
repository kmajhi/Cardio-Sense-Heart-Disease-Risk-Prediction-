// The health report: a self-contained HTML page built from the profile and
// the assessment history. Downloaded as a file, or opened and printed
// (the browser's "Save as PDF"). Also the short text used for sharing.
import {
  HISTORY,
  activityLabel,
  ageFrom,
  bmiBand,
  bmiFrom,
  sexLabel,
  smokerLabel,
} from './profileFields';
import { isPhoto } from './photo';

const LEVELS = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' };
const DISCLAIMER =
  'Research prototype. Not externally validated, not approved for clinical use. Risk figures are model estimates, not diagnoses.';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const yesNo = (v) => (v === 1 ? 'Yes' : v === 0 ? 'No' : '—');
const or = (v, fallback = '—') => (v === '' || v === null || v === undefined ? fallback : v);

export const reportFileName = (today = new Date()) => `cardio-sense-report-${today.toISOString().slice(0, 10)}.html`;

export function buildReportHtml(profile, records = [], today = new Date()) {
  const age = ageFrom(profile.date_of_birth, today);
  const bmi = bmiFrom(profile.height_cm, profile.weight_kg);
  const band = bmiBand(bmi);
  const latest = records.at(-1);
  const rows = (pairs) =>
    pairs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');

  const assessment = latest
    ? `
    <section>
      <h2>Latest risk estimate</h2>
      <div class="score">
        <strong>${Math.round(latest.result.probability * 100)}%</strong>
        <span>${esc(LEVELS[latest.result.risk_level] ?? latest.result.risk_level)} · ${esc(dayFmt.format(new Date(latest.created_at)))}</span>
      </div>
      <h3>What moved this estimate</h3>
      <table>${rows(
        latest.result.top_factors.map((f) => [
          f.name,
          `${f.contribution > 0 ? 'Raised' : 'Lowered'} ${Math.abs(f.contribution * 100).toFixed(1)} pts`,
        ]),
      )}</table>
      <h3>Estimate history</h3>
      <table class="cols"><tr><th>Date</th><th>Estimate</th><th>Level</th></tr>${records
        .map(
          (r) =>
            `<tr><td>${esc(dayFmt.format(new Date(r.created_at)))}</td><td>${Math.round(r.result.probability * 100)}%</td><td>${esc(
              LEVELS[r.result.risk_level] ?? r.result.risk_level,
            )}</td></tr>`,
        )
        .join('')}</table>
    </section>`
    : '<section><h2>Latest risk estimate</h2><p>No assessments yet.</p></section>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cardio Sense health report · ${esc(profile.full_name)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #f4f2f8; color: #1c1633; font: 14px/1.5 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  main { max-width: 760px; margin: 32px auto; padding: 40px; border-radius: 24px; background: #fff; box-shadow: 0 30px 60px -40px rgba(58, 28, 150, .5); }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 20px; border-bottom: 2px solid #6833e4; }
  .brand { color: #ed3a4f; font-weight: 800; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 4px 0 0; font-size: 28px; font-weight: 300; letter-spacing: -.02em; }
  h1 b { font-weight: 800; }
  .who { display: flex; align-items: center; gap: 12px; }
  .photo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 3px #efe9fd; }
  .meta { color: rgba(28, 22, 51, .65); font-size: 12px; text-align: right; }
  h2 { margin: 28px 0 10px; font-size: 16px; }
  h3 { margin: 18px 0 6px; color: rgba(28, 22, 51, .7); font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 28px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 0; border-bottom: 1px solid rgba(28, 22, 51, .1); text-align: left; vertical-align: top; }
  th { width: 48%; color: rgba(28, 22, 51, .65); font-weight: 500; }
  table.cols th { width: auto; }
  .score { display: flex; align-items: baseline; gap: 12px; }
  .score strong { color: #6833e4; font-size: 40px; font-weight: 700; letter-spacing: -.03em; }
  .note { margin-top: 32px; padding: 12px 14px; border: 1px solid rgba(252, 183, 29, .6); border-radius: 12px; background: rgba(252, 183, 29, .12); color: #5c3d00; font-size: 12px; }
  @media (max-width: 640px) { main { margin: 0; padding: 24px 18px; border-radius: 0; } .grid { grid-template-columns: 1fr; } }
  @media print { body { background: #fff; } main { margin: 0; box-shadow: none; padding: 0; } }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="brand">Cardio Sense</div>
      <h1>Health <b>report</b></h1>
    </div>
    <div class="who">
      ${isPhoto(profile.photo) ? `<img class="photo" src="${esc(profile.photo)}" alt="" />` : ''}
      <div class="meta">${esc(profile.full_name)}<br />Generated ${esc(dayFmt.format(today))}</div>
    </div>
  </header>

  <div class="grid">
    <section>
      <h2>Personal</h2>
      <table>${rows([
        ['Name', or(profile.full_name)],
        ['Age', age === null ? '—' : `${age} years`],
        ['Sex', or(sexLabel(profile.sex))],
        ['Blood group', or(profile.blood_group)],
        ['Email', or(profile.email)],
        ['Phone', or(profile.phone)],
      ])}</table>
    </section>
    <section>
      <h2>Body &amp; lifestyle</h2>
      <table>${rows([
        ['Height', profile.height_cm === '' ? '—' : `${profile.height_cm} cm`],
        ['Weight', profile.weight_kg === '' ? '—' : `${profile.weight_kg} kg`],
        ['BMI', bmi === null ? '—' : `${bmi.toFixed(1)} kg/m² (${band.label})`],
        ['Smoking', or(smokerLabel(profile.smoker))],
        ['Physical activity', or(activityLabel(profile.activity))],
      ])}</table>
    </section>
    <section>
      <h2>Medical history</h2>
      <table>${rows(HISTORY.map((h) => [h.label, yesNo(profile[h.key])]))}</table>
    </section>
    <section>
      <h2>Medications &amp; allergies</h2>
      <table>${rows([
        ['Medications', profile.medications.length ? profile.medications.join(', ') : 'None listed'],
        ['Allergies', profile.allergies.length ? profile.allergies.join(', ') : 'None listed'],
        ['Emergency contact', [profile.emergency_name, profile.emergency_phone].filter(Boolean).join(' · ') || '—'],
      ])}</table>
    </section>
  </div>

  ${assessment}

  <p class="note">${esc(DISCLAIMER)}</p>
</main>
</body>
</html>`;
}

/**
 * Text for a social post. Only includes what the user ticked: health data
 * is personal, so the default is just the risk level.
 */
export function buildShareText(profile, latest, include) {
  const parts = [];
  if (latest && (include.level || include.percent)) {
    const level = (LEVELS[latest.result.risk_level] ?? latest.result.risk_level).toLowerCase();
    const pct = `${Math.round(latest.result.probability * 100)}%`;
    const what = include.level && include.percent ? `${pct} (${level})` : include.percent ? pct : level;
    parts.push(`My latest Cardio Sense heart risk estimate: ${what}.`);
  }
  if (latest && include.trend && include.records?.length > 1) {
    const first = Math.round(include.records[0].result.probability * 100);
    const now = Math.round(latest.result.probability * 100);
    if (first !== now) parts.push(`It went ${now < first ? 'down' : 'up'} ${Math.abs(now - first)} points since my first check.`);
  }
  if (include.bmi) {
    const bmi = bmiFrom(profile.height_cm, profile.weight_kg);
    if (bmi !== null) parts.push(`BMI ${bmi.toFixed(1)}.`);
  }
  if (!parts.length) parts.push('I checked my heart health with Cardio Sense.');
  parts.push('A model estimate, not a diagnosis.');
  return parts.join(' ');
}
