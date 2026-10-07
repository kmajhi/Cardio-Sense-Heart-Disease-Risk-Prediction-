import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doctorApi } from '../../../api/doctorApi';
import { ConfirmDialog, Empty, Icon, LoadError, Skeleton, StatusBadge, Timeline, useLoad, useToast } from '../ui';
import { AIRecommendations, HealthInformation, KeyFindings, Origin, PatientContext, PatientSummary, RiskSummary } from '../clinical';
import { DECISIONS, NEEDS_ACTION_PLAN, drName, fmtDateTime, fmtTime, missingForSubmit, patientLine, unnamedMedicine } from '../format';
import { PrescriptionEditor, PrescriptionView } from '../Prescription';
import { withKeys, withoutKeys } from '../rxData';

const LIMITS = { action_plan: 5000, notes: 3000 };
const EMPTY_FORM = { decision: '', remarks: '', medications: [], action_plan: '', notes: '' };
const formOf = (review) =>
  review
    ? {
        decision: review.decision || '',
        remarks: review.remarks || '',
        medications: withKeys(review.medications),
        action_plan: review.action_plan || '',
        notes: review.notes || '',
      }
    : EMPTY_FORM;
/** The form as the server takes it (row keys are only for React). */
const bodyOf = (form) => ({ ...form, medications: withoutKeys(form.medications) });

function TextField({ id, label, required, help, value, onChange, placeholder, limit, error, rows = 6 }) {
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  return (
    <div className="dr-field">
      <label className="dr-label" htmlFor={id}>
        {label} {required && <span className="dr-req" aria-hidden="true">*</span>}
        {required && <span className="dr-sr">(required)</span>}
      </label>
      {help && (
        <p className="dr-help" id={helpId}>
          {help}
        </p>
      )}
      <textarea
        id={id}
        className="dr-textarea"
        rows={rows}
        value={value}
        maxLength={limit}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[help && helpId, error && errId].filter(Boolean).join(' ') || undefined}
      />
      <span className="dr-count">
        {value.length.toLocaleString()} / {limit.toLocaleString()}
      </span>
      {error && (
        <p className="dr-field-error" id={errId}>
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewForm({ ws, onSaved, onSubmitted }) {
  const toast = useToast();
  const ids = { plan: useId(), notes: useId(), decision: useId(), summary: useId() };
  const [form, setForm] = useState(() => formOf(ws.review));
  const [savedAt, setSavedAt] = useState(ws.review?.updated_at ?? null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');
  const [confirm, setConfirm] = useState(false);
  const submitting = useRef(false);

  // Leaving with unsaved text asks first (the browser's own prompt).
  useEffect(() => {
    if (!dirty) return undefined;
    const onLeave = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setProblem('');
  };

  const saveDraft = async () => {
    setBusy('draft');
    try {
      const r = await doctorApi.saveDraft(ws.id, bodyOf(form));
      setSavedAt(r.updated_at);
      setDirty(false);
      onSaved();
    } catch (err) {
      toast(err.status === 400 || err.status === 409 ? err.message : 'We couldn’t save your review. Please try again.', 'error');
    } finally {
      setBusy('');
    }
  };

  const askSubmit = () => {
    const missing = missingForSubmit(form);
    setProblem(missing);
    if (missing) {
      document.getElementById(ids.summary)?.focus();
      return;
    }
    setConfirm(true);
  };

  const submit = async () => {
    if (submitting.current) return; // no double submission
    submitting.current = true;
    setBusy('submit');
    try {
      const result = await doctorApi.submit(ws.id, bodyOf(form));
      setDirty(false);
      setConfirm(false);
      onSubmitted(result);
    } catch (err) {
      setConfirm(false);
      if (err.status === 409) onSubmitted(null);
      else toast(err.status === 400 ? err.message : 'We couldn’t submit your review. Your text is still here; please try again.', 'error');
    } finally {
      submitting.current = false;
      setBusy('');
    }
  };

  const err = (field) => {
    if (!problem) return '';
    if (field === 'decision' && !form.decision) return problem;
    if (field === 'remarks' && form.decision && !form.remarks.trim()) return problem;
    if (field === 'medications' && form.decision && form.remarks.trim() && unnamedMedicine(form.medications)) return problem;
    if (field === 'action_plan' && form.decision && form.remarks.trim() && !unnamedMedicine(form.medications) && NEEDS_ACTION_PLAN.has(form.decision) && !form.action_plan.trim()) return problem;
    return '';
  };

  return (
    <section className="dr-card dr-section dr-review-card" aria-labelledby="ws-review">
      <div className="dr-section-head">
        <div>
          <h2 className="dr-h2" id="ws-review">
            Doctor’s Clinical Review
          </h2>
          <p>Your own assessment. It is attached to the patient’s report only when you submit it.</p>
        </div>
        <Origin kind="doctor" />
      </div>
      <form className="dr-section-body dr-form" onSubmit={(e) => e.preventDefault()} noValidate>
        <div id={ids.summary} tabIndex={-1} aria-live="assertive">
          {problem && (
            <div className="dr-callout is-alert" role="alert">
              <Icon name="alert" />
              <p>{problem}</p>
            </div>
          )}
        </div>

        <PrescriptionEditor
          ws={ws}
          remarks={form.remarks}
          medications={form.medications}
          onRemarks={set('remarks')}
          onMedications={set('medications')}
          error={err('remarks')}
          medError={err('medications')}
        />

        <fieldset className="dr-field" style={{ border: 0, margin: 0, padding: 0 }} aria-describedby={err('decision') ? `${ids.decision}-err` : undefined}>
          <legend className="dr-label" style={{ marginBottom: 6 }}>
            Review Decision <span className="dr-req" aria-hidden="true">*</span>
            <span className="dr-sr">(required)</span>
          </legend>
          <div className="dr-decisions" role="radiogroup">
            {DECISIONS.map((d) => (
              <label key={d.id} className={`dr-decision${form.decision === d.id ? ' is-on' : ''}`}>
                <input type="radio" name={ids.decision} value={d.id} checked={form.decision === d.id} onChange={() => set('decision')(d.id)} />
                <span>{d.label}</span>
              </label>
            ))}
          </div>
          {err('decision') && (
            <p className="dr-field-error" id={`${ids.decision}-err`}>
              {err('decision')}
            </p>
          )}
        </fieldset>

        <TextField
          id={ids.plan}
          label="Clinical Action Plan"
          required={NEEDS_ACTION_PLAN.has(form.decision)}
          help={NEEDS_ACTION_PLAN.has(form.decision) ? 'Required for this decision.' : 'Optional for this decision.'}
          value={form.action_plan}
          onChange={set('action_plan')}
          limit={LIMITS.action_plan}
          placeholder="Enter recommended follow-up, investigations, referral, lifestyle guidance, or other appropriate clinical actions..."
          error={err('action_plan')}
        />

        <TextField
          id={ids.notes}
          label="Additional Notes"
          help="Internal: kept with the review for clinical staff. Never shown to the patient or printed in the report."
          value={form.notes}
          onChange={set('notes')}
          limit={LIMITS.notes}
          rows={3}
        />

        <div className="dr-form-foot">
          <span className="dr-saved" aria-live="polite">
            {busy === 'draft' ? 'Saving draft…' : dirty ? 'Unsaved changes' : savedAt ? `Draft saved at ${fmtTime(savedAt)}` : 'Not saved yet'}
          </span>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/doctor/active" className="dr-btn is-ghost">
              Back
            </Link>
            <button type="button" className="dr-btn is-secondary" onClick={saveDraft} disabled={Boolean(busy)}>
              Save Draft
            </button>
            <button type="button" className="dr-btn is-primary" onClick={askSubmit} disabled={Boolean(busy)}>
              Submit Clinical Review
            </button>
          </span>
        </div>
      </form>

      <ConfirmDialog open={confirm} title="Submit Clinical Review?" confirmLabel="Submit Review" busy={busy === 'submit'} onConfirm={submit} onCancel={() => setConfirm(false)}>
        <p>You are about to finalize your review for Assessment {ws.assessment}.</p>
        <p>Your prescription and decision will be attached to the patient’s assessment and the patient report will be updated. A submitted review can’t be edited.</p>
      </ConfirmDialog>
    </section>
  );
}

function SubmittedReview({ ws }) {
  const r = ws.review;
  return (
    <section className="dr-card dr-section dr-review-card" aria-labelledby="ws-done">
      <div className="dr-section-head">
        <div>
          <h2 className="dr-h2" id="ws-done">
            Doctor’s Clinical Review
          </h2>
          <p>
            Submitted {fmtDateTime(r.submitted_at)} by {drName(ws.doctor?.name ?? '')}. Read-only: the patient’s record keeps exactly this.
          </p>
        </div>
        <Origin kind="doctor" />
      </div>
      <div className="dr-section-body dr-form">
        <div>
          <p className="dr-eyebrow">Review decision</p>
          <span className="dr-badge is-teal">{r.decision_label}</span>
        </div>
        <PrescriptionView ws={ws} review={r} />
        <div>
          <p className="dr-eyebrow">Clinical action plan</p>
          <p className="dr-readonly">{r.action_plan || 'No action plan recorded.'}</p>
        </div>
        {r.notes && (
          <div>
            <p className="dr-eyebrow">Additional notes (internal)</p>
            <p className="dr-readonly">{r.notes}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Submitted({ ws, onView }) {
  return (
    <div className="dr-card dr-success" role="status">
      <span className="dr-empty-icon">
        <Icon name="checkCircle" size={26} />
      </span>
      <h1 className="dr-h1">Clinical Review Submitted</h1>
      <p className="dr-sub" style={{ marginTop: 8 }}>
        Assessment {ws.assessment} has been successfully reviewed.
      </p>
      <p className="dr-muted">The clinical review has been recorded and the patient’s report has been updated. The patient has been notified in the app.</p>
      <div className="dr-success-actions">
        <button type="button" className="dr-btn is-secondary" onClick={onView}>
          View Completed Review
        </button>
        <Link to="/doctor" className="dr-btn is-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

/**
 * The clinical review workspace for one assigned request (/doctor/review/:id):
 * patient context on the left, the case top to bottom on the right, and the
 * doctor's own review form at the end.
 */
export default function Workspace({ blocked, refreshCounts }) {
  const { id } = useParams();
  const { data: ws, error, loading, reload } = useLoad(() => (blocked ? Promise.resolve(null) : doctorApi.review(id)), [id, blocked]);
  const [submitted, setSubmitted] = useState(false);

  if (blocked) return null;
  if (loading && !ws) {
    return (
      <div className="dr-ws">
        <div className="dr-card">
          <Skeleton rows={4} />
        </div>
        <div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="dr-card dr-section">
              <Skeleton rows={3} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return error.status === 404 ? (
      <div className="dr-card">
        <Empty icon="lock" title="This review isn’t available to you" action={<Link to="/doctor/requests" className="dr-btn is-secondary">Back to Review Requests</Link>}>
          It may be assigned to another doctor, or the patient may have withdrawn it. Only the assigned doctor can open a clinical review.
        </Empty>
      </div>
    ) : (
      <div className="dr-card">
        <LoadError error={error} onRetry={reload} />
      </div>
    );
  }
  if (submitted) {
    return (
      <Submitted
        ws={ws}
        onView={() => {
          setSubmitted(false);
          reload();
        }}
      />
    );
  }

  const done = ws.status === 'completed' && ws.review?.status === 'submitted';
  const detail = ws.assessment_detail;
  return (
    <>
      <div className="dr-ws-head">
        <div>
          <p className="dr-eyebrow">
            <Link to={done ? '/doctor/completed' : '/doctor/active'} className="dr-link" style={{ textTransform: 'none', letterSpacing: 0 }}>
              ← {done ? 'Completed Reviews' : 'My Active Reviews'}
            </Link>
          </p>
          <h1 className="dr-h1">Clinical Review</h1>
          <p className="dr-sub">
            Assessment <span className="dr-ref">{ws.assessment}</span> · {ws.patient.name}, {patientLine(ws.patient)}
          </p>
          <p style={{ margin: '8px 0 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={ws.status} label={ws.status_label} />
            {ws.doctor && <span className="dr-muted">Reviewed by {drName(ws.doctor.name)}</span>}
          </p>
        </div>
        {done && (
          <div className="dr-ws-actions">
            <a className="dr-btn is-secondary" href={doctorApi.reportUrl(ws.id)} download>
              <Icon name="download" size={16} /> Updated report (PDF)
            </a>
          </div>
        )}
      </div>

      <div className="dr-ws">
        <PatientContext ws={ws} />
        <div>
          <PatientSummary ws={ws} />
          <RiskSummary detail={detail} />
          <KeyFindings detail={detail} />
          <HealthInformation detail={detail} />
          <AIRecommendations detail={detail} />
          {done ? (
            <SubmittedReview ws={ws} />
          ) : (
            <ReviewForm
              ws={ws}
              onSaved={() => {}}
              onSubmitted={(result) => {
                refreshCounts?.();
                if (result) setSubmitted(true);
                reload();
              }}
            />
          )}
          <section className="dr-card dr-section" aria-labelledby="ws-timeline">
            <div className="dr-section-head">
              <h2 className="dr-h2" id="ws-timeline">
                Review Timeline
              </h2>
            </div>
            <div className="dr-section-body">
              <Timeline
                events={ws.timeline}
                future={done ? [] : ['Clinical review submitted', 'Report updated', 'Patient notified']}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
