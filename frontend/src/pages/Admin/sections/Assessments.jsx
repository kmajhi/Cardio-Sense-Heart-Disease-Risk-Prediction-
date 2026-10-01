import { useEffect, useState } from 'react';
import { admin, download } from '../../../api/adminApi';
import {
  Badge, ConfirmDialog, DataTable, Drawer, ErrorNote, Facts, Loading, PageHeader, Pagination, RiskBadge,
  SearchBox, Select, Toolbar, fmtDateTime, fmtPct, useDebounced, useLoad, useToast,
} from '../ui';

// Payload keys → readable labels, in form order.
const INPUTS = [
  ['age', 'Age', 'years'], ['sex', 'Sex', ''], ['height_cm', 'Height', 'cm'], ['weight_kg', 'Weight', 'kg'],
  ['family_history', 'Family history', ''], ['hypertension', 'Hypertension', ''], ['diabetes', 'Diabetes', ''],
  ['chest_pain_history', 'Chest pain history', ''], ['bp_mmhg', 'Systolic BP', 'mmHg'], ['rbs_mmol_l', 'Random blood sugar', 'mmol/L'],
  ['total_cholesterol', 'Total cholesterol', 'mg/dL'], ['hdl', 'HDL', 'mg/dL'], ['ldl', 'LDL', 'mg/dL'], ['triglycerides', 'Triglycerides', 'mg/dL'],
  ['hemoglobin', 'Hemoglobin', 'g/dL'], ['creatinine', 'Creatinine', 'mg/dL'], ['platelets', 'Platelets', '/µL'],
  ['sodium', 'Sodium', 'mmol/L'], ['potassium', 'Potassium', 'mmol/L'], ['chloride', 'Chloride', 'mmol/L'],
  ['troponin_i', 'Troponin-I', ''], ['troponin_assay', 'Troponin assay', ''],
];
const yesNo = new Set(['family_history', 'hypertension', 'diabetes', 'chest_pain_history']);

function showValue(key, value, unit) {
  if (value === null || value === undefined || value === '') return <span className="ad-muted">not measured</span>;
  if (yesNo.has(key)) return value ? 'Yes' : 'No';
  return `${typeof value === 'number' ? value.toLocaleString() : value}${unit ? ` ${unit}` : ''}`;
}

function AssessmentDetail({ refId, onClose, onChanged }) {
  const notify = useToast();
  const { data: a, error, loading, reload } = useLoad(() => admin.assessment(refId), [refId]);
  const [notes, setNotes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const saveNotes = async () => {
    setBusy(true);
    try {
      await admin.saveNotes(refId, notes ?? a.notes);
      notify('Notes saved.');
      reload();
      onChanged();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await admin.deleteAssessment(refId);
      notify(`${refId} deleted.`);
      onChanged();
      onClose();
    } catch (err) {
      notify(err.message, 'error');
      setBusy(false);
    }
  };

  const biggest = a ? Math.max(0.0001, ...a.top_factors.map((f) => Math.abs(f.contribution))) : 1;

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Assessment ${refId}`}
      subtitle={a ? `${a.user.name || 'No account'} · ${fmtDateTime(a.created_at)}` : ''}
      footer={
        a && (
          <button type="button" className="ad-btn is-danger" onClick={() => setConfirm(true)}>
            Delete assessment
          </button>
        )
      }
    >
      {loading && !a && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      {a && (
        <>
          <div className="ad-result">
            <span className="ad-result-pct">{fmtPct(a.probability)}</span>
            <RiskBadge level={a.risk_level} />
            {a.low_confidence && <Badge tone="warn">Low confidence</Badge>}
          </div>
          {a.missing_fields?.length > 0 && <p className="ad-note">Estimated without: {a.missing_fields.join(', ')}.</p>}
          {a.outside_training?.length > 0 && (
            <p className="ad-note">
              Beyond the training data:{' '}
              {a.outside_training.map((o) => `${o.name} ${o.value} ${o.unit} (range ${o.min}–${o.max})`).join('; ')}.
            </p>
          )}

          <h3 className="ad-h3">What moved the estimate</h3>
          <ul className="ad-factors">
            {a.top_factors.map((f) => (
              <li key={f.name}>
                <span>{f.name}</span>
                <span className="ad-factor-bar" aria-hidden="true">
                  <span className={f.contribution > 0 ? 'is-up' : 'is-down'} style={{ width: `${(Math.abs(f.contribution) / biggest) * 100}%` }} />
                </span>
                <span className={f.contribution > 0 ? 'ad-up' : 'ad-down'}>
                  {f.contribution > 0 ? '+' : '−'}
                  {Math.abs(f.contribution * 100).toFixed(1)} pts
                </span>
              </li>
            ))}
          </ul>

          <h3 className="ad-h3">Inputs</h3>
          <Facts items={INPUTS.map(([k, label, unit]) => [label, showValue(k, a.inputs[k], k === 'troponin_i' ? (a.inputs.troponin_assay === 'high-sensitivity' ? 'ng/L' : 'ng/mL') : unit)])} />

          <h3 className="ad-h3">Model</h3>
          <Facts items={[['Model', a.model_name || '—'], ['Trained', a.model_trained_at ? fmtDateTime(a.model_trained_at) : '—'], ['Account', a.user.email || 'none']]} />

          <h3 className="ad-h3">Staff notes</h3>
          <p className="ad-muted">Visible to staff only, never to the user.</p>
          <textarea className="ad-textarea" rows={4} maxLength={4000} value={notes ?? a.notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Reviewed with the clinic; follow-up booked." />
          <div className="ad-actions-row">
            <button type="button" className="ad-btn is-primary" disabled={busy || (notes ?? a.notes) === a.notes} onClick={saveNotes}>
              Save notes
            </button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title={`Delete ${refId}?`}
        body={<p>The assessment is removed from the user’s History for good.</p>}
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={remove}
      />
    </Drawer>
  );
}

export default function Assessments({ initialRef, onOpened }) {
  const notify = useToast();
  const [q, setQ] = useState('');
  const [risk, setRisk] = useState('');
  const [lowConf, setLowConf] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(initialRef ?? null);
  useEffect(() => {
    if (initialRef) {
      setSelected(initialRef);
      onOpened?.();
    }
  }, [initialRef, onOpened]);
  const search = useDebounced(q);
  const filters = { q: search, risk, low_confidence: lowConf, date_from: dateFrom, date_to: dateTo };
  const { data, error, loading, reload } = useLoad(() => admin.assessments({ ...filters, page }), [search, risk, lowConf, dateFrom, dateTo, page]);
  const filter = (setter) => (v) => {
    setter(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Every prediction saved by users"
        actions={
          <button type="button" className="ad-btn" onClick={() => download('/admin/assessments/export/', filters, 'assessments.csv').catch((e) => notify(e.message, 'error'))}>
            Export CSV
          </button>
        }
      />
      <Toolbar>
        <SearchBox value={q} onChange={filter(setQ)} placeholder="Search A-0012, email or notes" />
        <Select label="Risk" value={risk} onChange={filter(setRisk)} options={[['', 'All'], ['low', 'Low'], ['moderate', 'Moderate'], ['high', 'High']]} />
        <Select label="Confidence" value={lowConf} onChange={filter(setLowConf)} options={[['', 'All'], ['1', 'Low confidence only']]} />
        <label className="ad-select">
          <span>From</span>
          <input type="date" value={dateFrom} onChange={(e) => filter(setDateFrom)(e.target.value)} />
        </label>
        <label className="ad-select">
          <span>To</span>
          <input type="date" value={dateTo} onChange={(e) => filter(setDateTo)(e.target.value)} />
        </label>
      </Toolbar>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <DataTable
            rows={data?.results}
            onRowClick={(r) => setSelected(r.id)}
            empty="No assessments match these filters."
            columns={[
              { key: 'id', label: 'Ref', render: (r) => <strong>{r.id}</strong> },
              { key: 'when', label: 'When', render: (r) => fmtDateTime(r.created_at) },
              { key: 'user', label: 'User', render: (r) => r.user.email || <span className="ad-muted">no account</span> },
              { key: 'patient', label: 'Patient', render: (r) => (r.age ? `${r.age} y · ${r.sex}` : '—') },
              { key: 'probability', label: 'Estimate', align: 'right', render: (r) => fmtPct(r.probability) },
              { key: 'risk', label: 'Band', render: (r) => <RiskBadge level={r.risk_level} /> },
              {
                key: 'flags',
                label: 'Flags',
                render: (r) => (
                  <span className="ad-chips">
                    {r.low_confidence && <Badge tone="warn">Low confidence</Badge>}
                    {r.has_notes && <Badge>Notes</Badge>}
                  </span>
                ),
              },
            ]}
          />
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onPage={setPage} />}
        </>
      )}
      {selected && <AssessmentDetail refId={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </>
  );
}
