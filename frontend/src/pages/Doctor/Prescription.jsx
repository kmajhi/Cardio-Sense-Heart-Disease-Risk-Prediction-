import { useId } from 'react';
import { Icon } from './ui';
import { drName, fmtDate, patientLine, unnamedMedicine } from './format';
import { DURATIONS, FREQUENCIES, MAX_MEDICATIONS, MED_LIMITS, MEDICINES, REMARKS_LIMIT, TIMINGS, blankMedicine } from './rxData';


function MedicineRow({ med, n, listIds, onChange, onRemove, error }) {
  const id = useId();
  const set = (field) => (e) => onChange({ ...med, [field]: e.target.value });
  const input = (field, label, props = {}) => (
    <label className={`dr-rx-in is-${field}`} htmlFor={`${id}-${field}`}>
      <span>{label}</span>
      <input
        id={`${id}-${field}`}
        className="dr-input"
        value={med[field]}
        maxLength={MED_LIMITS[field]}
        onChange={set(field)}
        autoComplete="off"
        {...props}
      />
    </label>
  );
  return (
    <li className={`dr-rx-med${error ? ' is-invalid' : ''}`}>
      <span className="dr-rx-num" aria-hidden="true">
        {n}
      </span>
      <div className="dr-rx-med-grid" role="group" aria-label={`Medicine ${n}`}>
        {input('name', 'Medicine', { list: listIds.medicines, placeholder: 'e.g. Atorvastatin', 'aria-invalid': Boolean(error) || undefined })}
        {input('strength', 'Strength', { placeholder: 'e.g. 20 mg' })}
        {input('frequency', 'Frequency', { list: listIds.frequencies, placeholder: 'e.g. Twice daily (1-0-1)' })}
        <label className="dr-rx-in is-timing" htmlFor={`${id}-timing`}>
          <span>Timing</span>
          <select id={`${id}-timing`} className="dr-select" value={med.timing} onChange={set('timing')}>
            <option value="">Not specified</option>
            {TIMINGS.concat(med.timing && !TIMINGS.includes(med.timing) ? [med.timing] : []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {input('duration', 'Duration', { list: listIds.durations, placeholder: 'e.g. 1 month' })}
        {input('instructions', 'Instructions', { placeholder: 'e.g. Check blood pressure before each dose' })}
        {error && <p className="dr-field-error dr-rx-med-error">{error}</p>}
      </div>
      <button type="button" className="dr-icon-btn dr-rx-remove" onClick={onRemove} aria-label={`Remove medicine ${n}${med.name ? ` (${med.name})` : ''}`}>
        <Icon name="trash" size={16} />
      </button>
    </li>
  );
}

/** Who the prescription is for and who writes it, read from the case and the doctor's account. */
function Letterhead({ ws, date }) {
  return (
    <dl className="dr-rx-meta">
      <div>
        <dt>Patient</dt>
        <dd>{ws.patient.name}</dd>
      </div>
      <div>
        <dt>Age · Sex</dt>
        <dd>{patientLine(ws.patient)}</dd>
      </div>
      <div>
        <dt>Assessment</dt>
        <dd className="dr-ref">{ws.assessment}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>{fmtDate(date)}</dd>
      </div>
    </dl>
  );
}

function Signature({ ws, note }) {
  const d = ws.doctor;
  return (
    <footer className="dr-rx-foot">
      <div className="dr-rx-sign">
        <strong>{d ? drName(d.name) : 'Reviewing doctor'}</strong>
        <span>{[d?.specialty, d?.doctor_id, d?.registration_number && `Reg. ${d.registration_number}`].filter(Boolean).join(' · ')}</span>
      </div>
      <p className="dr-rx-sign-note">
        <Icon name="shield" size={14} /> {note}
      </p>
    </footer>
  );
}

/**
 * The doctor's prescription: diagnosis and advice (the review's `remarks`, required)
 * and the prescribed medicines (optional), laid out like a prescription pad.
 */
export function PrescriptionEditor({ ws, remarks, medications, onRemarks, onMedications, error, medError }) {
  const titleId = useId();
  const notesId = useId();
  const listBase = useId();
  const listIds = { medicines: `${listBase}-med`, frequencies: `${listBase}-freq`, durations: `${listBase}-dur` };
  const full = medications.length >= MAX_MEDICATIONS;
  const add = () => !full && onMedications([...medications, blankMedicine()]);
  const unnamed = medError ? unnamedMedicine(medications) - 1 : -1;

  return (
    <section className="dr-rx" aria-labelledby={titleId}>
      <header className="dr-rx-head">
        <span className="dr-rx-mark" aria-hidden="true">
          ℞
        </span>
        <div>
          <h3 className="dr-rx-title" id={titleId}>
            Doctor’s Prescription <span className="dr-req" aria-hidden="true">*</span>
            <span className="dr-sr">(required)</span>
          </h3>
          <p>Written for the patient. It appears in their review and updated PDF report once you submit.</p>
        </div>
      </header>

      <Letterhead ws={ws} date={new Date().toISOString()} />

      <div className="dr-rx-body">
        <div className="dr-field">
          <label className="dr-label" htmlFor={notesId}>
            Diagnosis &amp; advice <span className="dr-sr">for the Doctor’s Prescription (required)</span>
          </label>
          <p className="dr-help" id={`${notesId}-help`}>
            Your clinical impression, then advice for the patient: diet, activity, warning signs and when to seek care.
          </p>
          <textarea
            id={notesId}
            className="dr-textarea"
            rows={6}
            value={remarks}
            maxLength={REMARKS_LIMIT}
            placeholder={'Impression: e.g. Stage 1 hypertension with raised LDL cholesterol.\n\nAdvice: e.g. Reduce salt, walk 30 minutes on most days, seek urgent care for chest pain.'}
            onChange={(e) => onRemarks(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={[`${notesId}-help`, error && `${notesId}-err`].filter(Boolean).join(' ')}
          />
          <span className="dr-count">
            {remarks.length.toLocaleString()} / {REMARKS_LIMIT.toLocaleString()}
          </span>
          {error && (
            <p className="dr-field-error" id={`${notesId}-err`}>
              {error}
            </p>
          )}
        </div>

        <div className="dr-rx-meds">
          <div className="dr-rx-meds-head">
            <h4>
              <span className="dr-rx-mini" aria-hidden="true">
                ℞
              </span>
              Medicines
            </h4>
            <span className="dr-muted">
              {medications.length ? `${medications.length} of ${MAX_MEDICATIONS}` : 'Optional'}
            </span>
          </div>
          {medications.length === 0 ? (
            <div className="dr-rx-empty">
              <Icon name="pill" size={22} />
              <p>No medicines prescribed. Add one if the patient should start or continue a medicine.</p>
            </div>
          ) : (
            <ol className="dr-rx-list">
              {medications.map((m, i) => (
                <MedicineRow
                  key={m.key}
                  med={m}
                  n={i + 1}
                  listIds={listIds}
                  error={i === unnamed ? medError : ''}
                  onChange={(next) => onMedications(medications.map((x) => (x.key === m.key ? next : x)))}
                  onRemove={() => onMedications(medications.filter((x) => x.key !== m.key))}
                />
              ))}
            </ol>
          )}
          <button type="button" className="dr-btn is-secondary dr-rx-add" onClick={add} disabled={full}>
            <Icon name="plus" size={16} /> {full ? `Up to ${MAX_MEDICATIONS} medicines` : 'Add medicine'}
          </button>
          <datalist id={listIds.medicines}>
            {MEDICINES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <datalist id={listIds.frequencies}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <datalist id={listIds.durations}>
            {DURATIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      </div>

      <Signature ws={ws} note="Signed electronically from your authenticated account when you submit. No handwritten signature is used." />
    </section>
  );
}

/** A submitted prescription, read-only, as the patient's record keeps it. */
export function PrescriptionView({ ws, review }) {
  const meds = review.medications || [];
  return (
    <section className="dr-rx is-readonly" aria-label="Doctor’s Prescription">
      <header className="dr-rx-head">
        <span className="dr-rx-mark" aria-hidden="true">
          ℞
        </span>
        <div>
          <h3 className="dr-rx-title">Doctor’s Prescription</h3>
          <p>As submitted. The patient sees exactly this.</p>
        </div>
      </header>
      <Letterhead ws={ws} date={review.submitted_at} />
      <div className="dr-rx-body">
        <div>
          <p className="dr-eyebrow">Diagnosis &amp; advice</p>
          <p className="dr-readonly">{review.remarks}</p>
        </div>
        <div className="dr-rx-meds">
          <div className="dr-rx-meds-head">
            <h4>
              <span className="dr-rx-mini" aria-hidden="true">
                ℞
              </span>
              Medicines
            </h4>
          </div>
          {meds.length === 0 ? (
            <p className="dr-muted" style={{ margin: 0 }}>
              No medicines prescribed.
            </p>
          ) : (
            <div className="dr-table-wrap">
              <table className="dr-table dr-rx-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Medicine</th>
                    <th scope="col">Frequency</th>
                    <th scope="col">Timing</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {meds.map((m, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{m.name}</strong>
                        {m.strength && <span className="dr-muted"> {m.strength}</span>}
                      </td>
                      <td>{m.frequency || '—'}</td>
                      <td>{m.timing || '—'}</td>
                      <td>{m.duration || '—'}</td>
                      <td>{m.instructions || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Signature ws={ws} note="Signed electronically from the reviewer’s authenticated account." />
    </section>
  );
}
