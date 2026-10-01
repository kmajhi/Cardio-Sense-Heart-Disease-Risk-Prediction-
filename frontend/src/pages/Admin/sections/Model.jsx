import { useState } from 'react';
import { admin } from '../../../api/adminApi';
import { Badge, DataTable, ErrorNote, Facts, Loading, PageHeader, Panel, RiskBadge, Stat, fmtBytes, fmtDateTime, fmtPct, useLoad, useToast } from '../ui';

const num = (v, d = 3) => (v === undefined || v === null || v === '' ? '—' : Number(v).toFixed(d));

function TestPrediction() {
  const notify = useToast();
  const [sample, setSample] = useState('moderate');
  const [json, setJson] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (body) => {
    setBusy(true);
    try {
      const res = await admin.testModel(body);
      setResult(res);
      if (!json) setJson(JSON.stringify(res.payload, null, 2));
    } catch (err) {
      notify(err.message, 'error');
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const runJson = () => {
    try {
      run(JSON.parse(json));
    } catch {
      notify('That isn’t valid JSON.', 'error');
    }
  };

  return (
    <Panel title="Test prediction" subtitle="Runs the live model on any input. Never saved, never shown to users.">
      <div className="ad-actions-row">
        <label className="ad-select">
          <span>Sample patient</span>
          <select value={sample} onChange={(e) => setSample(e.target.value)}>
            <option value="low">Low risk</option>
            <option value="moderate">Moderate risk</option>
            <option value="high">High risk · urgent</option>
          </select>
        </label>
        <button
          type="button"
          className="ad-btn is-primary"
          disabled={busy}
          onClick={() => {
            setJson('');
            run({ sample });
          }}
        >
          {busy ? 'Running…' : 'Run sample'}
        </button>
      </div>
      <label className="ad-field">
        <span>Or edit the request (JSON, API units)</span>
        <textarea className="ad-textarea is-code" rows={8} value={json} onChange={(e) => setJson(e.target.value)} placeholder="Run a sample first to get a starting point." />
      </label>
      <div className="ad-actions-row">
        <button type="button" className="ad-btn" disabled={busy || !json.trim()} onClick={runJson}>
          Run this request
        </button>
      </div>
      {result && (
        <div className="ad-test-result">
          <div className="ad-result">
            <span className="ad-result-pct">{fmtPct(result.result.probability)}</span>
            <RiskBadge level={result.result.risk_level} />
            {result.result.low_confidence && <Badge tone="warn">Low confidence</Badge>}
          </div>
          <p className="ad-muted">
            Top factors:{' '}
            {result.result.top_factors.map((f) => `${f.name} ${f.contribution > 0 ? '+' : '−'}${Math.abs(f.contribution * 100).toFixed(1)}`).join(' · ')}
          </p>
        </div>
      )}
    </Panel>
  );
}

export default function Model() {
  const notify = useToast();
  const { data, error, loading, reload } = useLoad(() => admin.model());
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState('');

  const runCheck = async () => {
    setBusy('check');
    try {
      setCheck(await admin.checkModel());
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const runReload = async () => {
    setBusy('reload');
    try {
      const res = await admin.reloadModel();
      notify(`${res.detail} (${res.seconds}s)`);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  const m = data.metadata;
  const metrics = m.selected_model_metrics ?? {};
  const cal = m.calibration ?? {};

  return (
    <>
      <PageHeader
        title="Model"
        subtitle={`${m.selected_model ?? 'No model'} · trained ${m.trained_at ? fmtDateTime(m.trained_at) : '—'}`}
        actions={
          <>
            <button type="button" className="ad-btn" onClick={runReload} disabled={Boolean(busy)}>
              {busy === 'reload' ? 'Reloading…' : 'Reload model'}
            </button>
            <button type="button" className="ad-btn is-primary" onClick={runCheck} disabled={Boolean(busy)}>
              {busy === 'check' ? 'Checking…' : 'Run health check'}
            </button>
          </>
        }
      />
      <div className="ad-callout is-info">{m.validation || 'Internal validation only.'}</div>

      {check && (
        <Panel title={check.ok ? 'Health check passed' : 'Health check found a problem'} subtitle={`The three sample patients, ${check.seconds}s`} className={check.ok ? 'is-ok' : 'is-danger'}>
          <ul className="ad-check-list">
            {check.results.map((r) => (
              <li key={r.sample}>
                <Badge tone={r.ok ? 'ok' : 'danger'}>{r.ok ? 'In band' : 'Out of band'}</Badge>
                <span>
                  {r.sample} sample → {fmtPct(r.probability)}
                </span>
                <RiskBadge level={r.risk_level} />
              </li>
            ))}
          </ul>
          {!check.ok && <p className="ad-note">Retune the sample patients (frontend fields.js → PRESETS) or review the model before releasing it.</p>}
        </Panel>
      )}

      <div className="ad-stats">
        <Stat label="Test ROC-AUC" value={num(metrics.test_roc_auc)} hint={`CV ${num(metrics.cv_roc_auc_mean)}`} />
        <Stat label="Accuracy" value={fmtPct(metrics.test_accuracy, 1)} hint={`Recall ${fmtPct(metrics.test_recall, 1)}`} />
        <Stat label="Brier score" value={num(metrics.test_brier)} hint={`${num(cal.test_brier_uncalibrated)} before calibration`} />
        <Stat label="State" value={data.loaded ? 'Loaded' : 'Idle'} hint={data.available ? 'artifacts present' : 'artifacts missing'} tone={data.available ? undefined : 'danger'} />
      </div>

      <div className="ad-grid-2">
        <Panel title="Model card">
          <Facts
            items={[
              ['Selected model', m.selected_model],
              ['Calibration', cal.method],
              ['Selection rule', m.selection_rule],
              ['Data', `${m.dataset} · ${m.modeling_rows} rows (${m.train_rows} train / ${m.test_rows} test)`],
              ['Left out', (m.deployment_excluded_columns ?? []).join(', ') || 'nothing'],
              ['Why', m.deployment_exclusion_reason],
              ['Inputs', `${(m.raw_input_features ?? []).length} features`],
              ['scikit-learn', m.sklearn_version],
              ['Risk bands', data.risk_bands.map((b) => `${b.level} < ${Math.round(b.below * 100)}%`).join(' · ')],
              ['Confusion matrix', metrics.test_confusion_matrix ? Object.entries(metrics.test_confusion_matrix).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' · ') : '—'],
            ]}
          />
        </Panel>
        <Panel title="Model comparison" subtitle="Cross-validated on the training data; the first row was selected">
          <DataTable
            rows={data.comparison}
            rowKey={(r) => r.Model}
            columns={[
              { key: 'Model', label: 'Model', render: (r) => <strong>{r.Model}</strong> },
              { key: 'auc', label: 'CV ROC-AUC', align: 'right', render: (r) => num(r['CV ROC-AUC Mean']) },
              { key: 'recall', label: 'CV recall', align: 'right', render: (r) => num(r['CV Recall Mean']) },
              { key: 'brier', label: 'CV Brier', align: 'right', render: (r) => num(r['CV Brier Mean']) },
              { key: 'tauc', label: 'Test ROC-AUC', align: 'right', render: (r) => num(r['Test ROC-AUC']) },
            ]}
          />
          <h3 className="ad-h3">Files</h3>
          <DataTable
            rows={data.files}
            rowKey={(r) => r.name}
            columns={[
              { key: 'name', label: 'File' },
              { key: 'size', label: 'Size', align: 'right', render: (r) => fmtBytes(r.size) },
              { key: 'modified', label: 'Modified', render: (r) => fmtDateTime(r.modified) },
            ]}
          />
        </Panel>
      </div>

      <div className="ad-grid-2">
        <TestPrediction />
        <Panel title="Training ranges" subtitle="Values beyond these are flagged as less reliable">
          <DataTable
            rows={data.feature_ranges}
            rowKey={(r) => r.name}
            columns={[
              { key: 'name', label: 'Feature' },
              { key: 'min', label: 'Min', align: 'right', render: (r) => Number(r.min).toLocaleString() },
              { key: 'median', label: 'Median', align: 'right', render: (r) => Number(r.median).toLocaleString() },
              { key: 'max', label: 'Max', align: 'right', render: (r) => Number(r.max).toLocaleString() },
              { key: 'missing', label: 'Missing', align: 'right', render: (r) => r.missing_in_training },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
