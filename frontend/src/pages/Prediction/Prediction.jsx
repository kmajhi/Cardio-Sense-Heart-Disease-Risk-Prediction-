import { useEffect, useMemo, useState } from 'react';
import NavBar from '../Dashboard/components/NavBar';
import SliderField from './components/SliderField';
import Segmented from './components/Segmented';
import TroponinField from './components/TroponinField';
import ResultCard from './components/ResultCard';
import {
  SECTIONS,
  HISTORY,
  DEFAULTS,
  PRESETS,
  bmiFrom,
  maxHRFrom,
  maxHRFormula,
  toPayload,
  troponinMissing,
} from './fields';
import { mockPredict } from './predictionMock';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, load sequence
import './Prediction.css';

const YES_NO = [
  [0, 'No'],
  [1, 'Yes'],
];

/**
 * Cardio Sense — Prediction page.
 *
 * Props
 * - predict:       async (payload) => { probability, risk_level, top_factors }.
 *                  Defaults to a mock; pass `predict` from api/predictionApi.js
 *                  once POST /api/predict/ exists.
 * - user, hasNotifications, LinkComponent, activePath: same as <Dashboard />.
 */
export default function Prediction({
  predict = mockPredict,
  user = { name: 'Demo User' },
  hasNotifications = false,
  LinkComponent = 'a',
  activePath = '/prediction',
}) {
  const [values, setValues] = useState(DEFAULTS);
  const [result, setResult] = useState(null); // { data, payload }
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [error, setError] = useState('');
  const [triedRun, setTriedRun] = useState(false);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));

  const payload = useMemo(() => toPayload(values), [values]);
  const stale = result !== null && JSON.stringify(result.payload) !== JSON.stringify(payload);
  const bmi = bmiFrom(values.height, values.weight);
  const maxHR = maxHRFrom(values.age, values.sex);

  const loadPreset = (preset) => {
    setValues(preset.values);
    setResult(null);
    setStatus('idle');
    setTriedRun(false);
  };

  const run = async (e) => {
    e.preventDefault();
    setTriedRun(true);
    if (troponinMissing(values)) {
      document.getElementById('pr-troponin')?.focus();
      return;
    }
    setStatus('loading');
    try {
      const data = await predict(payload);
      setResult({ data, payload });
      setStatus('idle');
    } catch (err) {
      setError(err?.message ?? '');
      setStatus('error');
    }
  };

  const section = (id) => SECTIONS.find((s) => s.id === id);
  const sliders = (id) =>
    section(id).fields.map((field) => (
      <SliderField key={field.key} field={field} value={values[field.key]} onChange={set(field.key)} />
    ));

  return (
    <div className={`pc-dash pc-predict${ready ? ' is-ready' : ''}`}>
      <NavBar
        user={user}
        hasNotifications={hasNotifications}
        activePath={activePath}
        LinkComponent={LinkComponent}
      />

      <main className="pc-pr-main">
        <header className="pc-pr-head">
          <div>
            <h1 className="pc-pr-title">
              <span className="pc-wipe pc-thin" style={{ '--d': '120ms' }}>
                Heart disease
              </span>{' '}
              <span className="pc-wipe pc-bold" style={{ '--d': '320ms' }}>
                risk prediction
              </span>
            </h1>
            <p className="pc-pr-sub pc-enter" style={{ '--d': '200ms' }}>
              Enter the patient's clinical values. The model estimates the probability of heart disease
              from the same measurements it was trained on.
            </p>
          </div>

          <div className="pc-pr-presets pc-enter" style={{ '--d': '140ms' }} role="group" aria-labelledby="pr-presets">
            <span id="pr-presets" className="pc-pr-presets-label">
              Sample inputs
            </span>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="pc-filter" onClick={() => loadPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
        </header>

        <form className="pc-pr-grid" onSubmit={run} noValidate>
          <div className="pc-pr-inputs">
            <section className="pc-pr-card pc-enter" style={{ '--d': '160ms' }} aria-labelledby="pr-s-profile">
              <h2 id="pr-s-profile" className="pc-pr-card-title">
                {section('profile').title}
              </h2>
              <div className="pc-pr-fields">
                <Segmented
                  id="pr-sex"
                  label="Sex"
                  options={[
                    ['M', 'Male'],
                    ['F', 'Female'],
                  ]}
                  value={values.sex}
                  onChange={set('sex')}
                />
                {sliders('profile')}
                <dl className="pc-pr-derived">
                  <div>
                    <dt>BMI</dt>
                    <dd>
                      {bmi.toFixed(1)} <span>kg/m²</span>
                    </dd>
                    <dd className="pc-pr-derived-note">From height and weight</dd>
                  </div>
                  <div>
                    <dt>Max heart rate</dt>
                    <dd>
                      {Math.round(maxHR)} <span>bpm</span>
                    </dd>
                    <dd className="pc-pr-derived-note">{maxHRFormula(values.sex)}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="pc-pr-card pc-enter" style={{ '--d': '200ms' }} aria-labelledby="pr-s-history">
              <h2 id="pr-s-history" className="pc-pr-card-title">
                Medical history
              </h2>
              <div className="pc-pr-fields pc-pr-fields--tight">
                {HISTORY.map((h) => (
                  <Segmented
                    key={h.key}
                    id={`pr-${h.key}`}
                    label={h.label}
                    options={YES_NO}
                    value={values[h.key]}
                    onChange={set(h.key)}
                    inline
                  />
                ))}
              </div>
            </section>

            <section
              className="pc-pr-card pc-pr-card--marker pc-enter"
              style={{ '--d': '240ms' }}
              aria-labelledby="pr-s-troponin"
            >
              <h2 id="pr-s-troponin" className="pc-pr-card-title">
                Cardiac marker · Troponin-I
              </h2>
              <TroponinField
                assay={values.troponinAssay}
                value={values.troponin}
                onAssayChange={(assay) => {
                  if (assay === values.troponinAssay) return;
                  setValues((v) => ({ ...v, troponinAssay: assay, troponin: '' }));
                  setTriedRun(false); // don't flag the field the user just cleared on purpose
                }}
                onValueChange={set('troponin')}
                showError={triedRun && troponinMissing(values)}
              />
            </section>

            {['vitals', 'lipids', 'blood'].map((id, i) => (
              <section
                key={id}
                className="pc-pr-card pc-enter"
                style={{ '--d': `${280 + i * 40}ms` }}
                aria-labelledby={`pr-s-${id}`}
              >
                <h2 id={`pr-s-${id}`} className="pc-pr-card-title">
                  {section(id).title}
                </h2>
                <div className="pc-pr-fields">{sliders(id)}</div>
              </section>
            ))}
          </div>

          <ResultCard status={status} data={result?.data} stale={stale} error={error} />
        </form>
      </main>
    </div>
  );
}
