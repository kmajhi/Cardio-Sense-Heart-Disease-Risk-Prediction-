// The read-only clinical sections of the review workspace. Everything shown
// comes from the saved assessment: its inputs, the model's saved result and the
// frozen guidance (exactly what the patient was shown). Nothing is recomputed,
// filled in or invented here, and each section says where its content came from.
import { RISK, pctText } from '../../clinical/risk';
import { Icon } from './ui';
import { SEX, drName, findingStatus, fmtDate, fmtDateTime, groupMeasurements, historyItems, keyFindings, patientLine } from './format';

const TROPONIN_UNIT = { quantitative: 'ng/mL', 'high-sensitivity': 'ng/L' };
const SECTION_ORDER = [
  ['diet', 'Diet'],
  ['activity', 'Exercise'],
  ['habits', 'Lifestyle'],
  ['doctor', 'Follow-up'],
];

/** Where a section's content comes from, so ML output is never mistaken for clinical information. */
export function Origin({ kind }) {
  const label = { patient: 'Patient-submitted', model: 'Machine-learning output', ai: 'Automated guidance', doctor: 'Doctor’s review' }[kind];
  return <span className={`dr-origin is-${kind}`}>{label}</span>;
}

function Section({ id, title, origin, note, children, className = '' }) {
  return (
    <section className={`dr-card dr-section ${className}`} aria-labelledby={id}>
      <div className="dr-section-head">
        <div>
          <h2 className="dr-h2" id={id}>
            {title}
          </h2>
          {note && <p>{note}</p>}
        </div>
        {origin && <Origin kind={origin} />}
      </div>
      <div className="dr-section-body">{children}</div>
    </section>
  );
}

export function PatientContext({ ws }) {
  const d = ws.doctor;
  return (
    <aside className="dr-card dr-ws-context" aria-label="Patient context">
      <div>
        <p className="dr-eyebrow">Patient</p>
        <div className="dr-ws-name">{ws.patient.name}</div>
        <div className="dr-muted">{patientLine(ws.patient)}</div>
      </div>
      <dl>
        <div>
          <dt>Assessment</dt>
          <dd className="dr-ref">{ws.assessment}</dd>
        </div>
        <div>
          <dt>Assessment date</dt>
          <dd>{fmtDate(ws.assessment_date)}</dd>
        </div>
        <div>
          <dt>Model estimate</dt>
          <dd>
            {pctText(ws.risk.probability)}% · {RISK[ws.risk.level]?.label}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{ws.status_label}</dd>
        </div>
        <div>
          <dt>Assigned doctor</dt>
          <dd>{d ? drName(d.name) : '—'}</dd>
        </div>
        <div>
          <dt>Requested</dt>
          <dd>{fmtDateTime(ws.requested_at)}</dd>
        </div>
      </dl>
    </aside>
  );
}

export function PatientSummary({ ws }) {
  return (
    <Section id="ws-patient" title="Patient Summary" origin="patient">
      <dl className="dr-facts">
        <div>
          <dt>Name</dt>
          <dd>{ws.patient.name}</dd>
        </div>
        <div>
          <dt>Age · Sex</dt>
          <dd>
            {ws.patient.age ?? '—'} years · {SEX[ws.patient.sex] ?? 'Not recorded'}
          </dd>
        </div>
        <div>
          <dt>Patient’s topic</dt>
          <dd>{ws.topic_label}</dd>
        </div>
        <div>
          <dt>Review requested</dt>
          <dd>{fmtDateTime(ws.requested_at)}</dd>
        </div>
      </dl>
      <p className="dr-eyebrow" style={{ marginTop: 16 }}>
        Patient’s question
      </p>
      {ws.question ? <p className="dr-readonly">{ws.question}</p> : <p className="dr-muted">The patient didn’t add a question.</p>}
    </Section>
  );
}

export function RiskSummary({ detail }) {
  const { result, model, created_at: when } = detail;
  const guidanceRisk = detail.guidance?.risk;
  const cautions = [];
  if (result.missing_fields?.length) cautions.push(`Not measured (filled in by the model from typical values): ${result.missing_fields.join(', ')}.`);
  if (result.outside_training?.length)
    cautions.push(`Outside the training data’s range: ${result.outside_training.map((o) => `${o.name} ${o.value}${o.unit ? ` ${o.unit}` : ''}`).join('; ')}.`);
  if (result.low_confidence) cautions.push('The app marked this estimate as low confidence.');
  return (
    <Section id="ws-risk" title="Machine-Learning Risk Estimate" origin="model" note="Model-generated estimate — not a diagnosis.">
      <div className="dr-risk">
        <div className="dr-risk-num">
          <strong>{pctText(result.probability)}%</strong>
          <span className={`dr-status-text is-${{ low: 'ok', moderate: 'warn', high: 'alert' }[result.risk_level]}`}>{RISK[result.risk_level]?.label}</span>
          <small>Band: {RISK[result.risk_level]?.range}</small>
        </div>
        <div className="dr-risk-meta">
          {guidanceRisk?.body && <p>{guidanceRisk.body}</p>}
          <p className="dr-muted">
            Model: {model.name || 'not recorded'}
            {model.calibration ? `, probabilities calibrated by ${model.calibration}` : ''}
            {model.trained_at ? `, trained ${fmtDate(model.trained_at)}` : ''}. Assessment date {fmtDate(when)}. Accuracy was measured by internal testing on one
            hospital’s data; the estimate has not been clinically validated.
          </p>
          {result.top_factors?.length > 0 && (
            <div>
              <p className="dr-eyebrow">Largest contributions to this estimate</p>
              <div className="dr-factors">
                {result.top_factors.slice(0, 6).map((f) => (
                  <span key={f.name} className="dr-chip">
                    {f.name} {f.contribution >= 0 ? '↑' : '↓'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {cautions.length > 0 && (
        <div className="dr-callout is-warn" style={{ marginTop: 16 }}>
          <Icon name="alert" />
          <p>
            <strong>Estimate reliability.</strong> {cautions.join(' ')}
          </p>
        </div>
      )}
    </Section>
  );
}

function resultOf(f, inputs) {
  if (f.status === 'missing') return { value: 'Not measured', unit: '' };
  if (f.key === 'troponin_i') return { value: f.display || String(inputs.troponin_i ?? '—'), unit: TROPONIN_UNIT[inputs.troponin_assay] ?? f.unit ?? '' };
  return { value: f.display || (f.value ?? '—'), unit: f.unit || '' };
}

export function KeyFindings({ detail }) {
  const items = keyFindings(detail.guidance?.findings);
  return (
    <Section
      id="ws-key"
      title="Key Findings"
      origin="ai"
      note="Values outside their reference range, most serious first, as graded by the app’s clinical rules at the time of the assessment."
    >
      {detail.guidance?.urgent && (
        <div className="dr-callout is-alert" style={{ marginBottom: 16 }}>
          <Icon name="alert" />
          <p>
            <strong>Value flagged for prompt attention.</strong> At least one value is in a range where guidelines advise prompt medical attention.
          </p>
        </div>
      )}
      {items.length === 0 ? (
        <p className="dr-muted">All assessed values are within their reference ranges.</p>
      ) : (
        <div className="dr-key-grid">
          {items.map((f) => {
            const r = resultOf(f, detail.inputs);
            const s = findingStatus(f);
            return (
              <div key={f.key} className="dr-key">
                <div className="dr-key-label">{f.label}</div>
                <div className="dr-key-value">
                  {r.value}
                  {r.unit && <small>{r.unit}</small>}
                </div>
                <div className={`dr-status-text is-${s.tone}`}>
                  {s.text}
                  {f.band && !s.text.toLowerCase().includes(f.band.toLowerCase()) ? ` · ${f.band}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export function HealthInformation({ detail }) {
  const { inputs } = detail;
  const groups = groupMeasurements(detail.guidance?.findings);
  const anthropometric = [
    ['Height', inputs.height_cm, 'cm'],
    ['Weight', inputs.weight_kg, 'kg'],
  ];
  return (
    <Section
      id="ws-measurements"
      title="Complete Health Information"
      origin="patient"
      note="Every value entered for this assessment, as saved. Reference ranges and statuses are the app’s; the reporting lab’s own range takes precedence."
    >
      <div className="dr-table-wrap">
        <table className="dr-table dr-params">
          <thead>
            <tr>
              <th scope="col">Parameter</th>
              <th scope="col" className="is-right">
                Result
              </th>
              <th scope="col">Unit</th>
              <th scope="col">Reference</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="dr-group-row">
              <td colSpan={5}>Anthropometric</td>
            </tr>
            {anthropometric.map(([label, v, unit]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="is-right dr-num">{v === null || v === undefined || v === '' ? 'Not measured' : v}</td>
                <td>{v === null || v === undefined || v === '' ? '' : unit}</td>
                <td>—</td>
                <td className="dr-muted">{v === null || v === undefined || v === '' ? 'Not assessed' : 'See BMI'}</td>
              </tr>
            ))}
            {groups.map((g) => (
              <GroupRows key={g.id} group={g} inputs={inputs} skipTitle={g.id === 'weight'} />
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="dr-h2" style={{ fontSize: 14, margin: '24px 0 8px' }}>
        Medical history
      </h3>
      <dl className="dr-history">
        {historyItems(inputs).map((h) => (
          <div key={h.key}>
            <dt>{h.label}</dt>
            <dd className={h.value === 'Yes' ? 'dr-status-text is-warn' : h.value === 'No' ? undefined : 'dr-muted'}>{h.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function GroupRows({ group, inputs, skipTitle }) {
  return (
    <>
      {!skipTitle && (
        <tr className="dr-group-row">
          <td colSpan={5}>{group.title}</td>
        </tr>
      )}
      {group.rows.map((f) => {
        const r = resultOf(f, inputs);
        const s = findingStatus(f);
        const label = f.key === 'troponin_i' && inputs.troponin_assay ? `${f.label} (${inputs.troponin_assay.replace('-', ' ')})` : f.label;
        return (
          <tr key={f.key}>
            <td>{label}</td>
            <td className="is-right dr-num">{r.value}</td>
            <td>{r.unit}</td>
            <td>{f.status === 'missing' ? '—' : f.range || '—'}</td>
            <td className={`dr-status-text is-${s.tone}`}>{s.text}</td>
          </tr>
        );
      })}
    </>
  );
}

export function AIRecommendations({ detail }) {
  const sections = Object.fromEntries((detail.guidance?.sections ?? []).map((s) => [s.id, s]));
  return (
    <Section
      id="ws-ai"
      title="AI-Generated Recommendations"
      origin="ai"
      note="Automated guidance generated from the assessment data by the app’s rule-based system, exactly as the patient saw it. Shown for your review: it is not doctor-approved unless your remarks say so."
    >
      <div className="dr-recs">
        {SECTION_ORDER.map(([id, title]) => {
          const items = sections[id]?.items ?? [];
          return (
            <div key={id} className="dr-rec">
              <h3>{title}</h3>
              {items.length === 0 ? (
                <p className="dr-muted" style={{ margin: 0, fontSize: 13.5 }}>
                  No recommendations in this area.
                </p>
              ) : (
                <ul>
                  {items.map((it) => (
                    <li key={it.id}>{it.text}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
