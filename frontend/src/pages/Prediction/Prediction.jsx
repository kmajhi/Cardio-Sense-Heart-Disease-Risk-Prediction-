import { useEffect, useMemo, useState } from 'react';
import NavBar from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
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
  troponinError,
  patientError,
  BMI_TRAIN,
} from './fields';
import { USE_MOCK } from '../../api/mode';
import { buildNotification } from '../../clinical/notifications';
import { useNotifications } from '../../notifications/NotificationsContext';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, load sequence
import './Prediction.css';

const TITLE = [
  ['Heart', 'thin'],
  ['disease', 'thin'],
  ['risk', 'bold'],
  ['prediction', 'bold'],
];

// A signed-out visitor's values, waiting to be run once they log in.
const PENDING_KEY = 'cardio-sense:pending-prediction';

function takePending() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function keepPending(pending) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* storage blocked: they'll just fill it in again after logging in */
  }
}

const YES_NO = [
  [0, 'No'],
  [1, 'Yes'],
];

/**
 * Cardio Sense — Prediction page.
 *
 * Props
 * - predict:       async (payload) => { probability, risk_level, top_factors,
 *                  missing_fields, low_confidence }: api/predictionApi.js.
 * - signedIn:      running the model needs an account (results go to History).
 *                  Signed out, Run keeps the values and calls onRequireLogin;
 *                  back here signed in, the prediction runs with them.
 * - user, hasNotifications, LinkComponent, activePath: same as <Dashboard />.
 */
export default function Prediction({
  predict,
  signedIn = true,
  onRequireLogin,
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
  const [justSaved, setJustSaved] = useState(false);
  const notifications = useNotifications();

  // Back from logging in to run a prediction: restore the values and run it now.
  useEffect(() => {
    if (!signedIn) return;
    const pending = takePending(); // read-and-clear, so it runs once
    if (!pending) return;
    setValues(pending.values);
    setTriedRun(true);
    setStatus('loading');
    predict(pending.payload)
      .then((data) => {
        setResult({ data, payload: pending.payload });
        notifications?.setLatest({ inputs: pending.payload, result: data, created_at: new Date().toISOString() });
        setJustSaved(true);
        setStatus('idle');
      })
      .catch((err) => {
        setError(err?.message ?? '');
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));

  const payload = useMemo(() => toPayload(values), [values]);
  const stale = result !== null && JSON.stringify(result.payload) !== JSON.stringify(payload);
  // Model risk + values outside healthy ranges, for the inputs the estimate was made from.
  const notification = useMemo(
    () => (result ? buildNotification({ inputs: result.payload, result: result.data }) : null),
    [result],
  );
  const bmi = bmiFrom(values.height, values.weight);
  // The sample the form still matches exactly; editing any value deselects it.
  const activePreset = PRESETS.find((p) => Object.keys(p.values).every((k) => p.values[k] === values[k]))?.id;
  const maxHR = maxHRFrom(values.age, values.sex);

  const loadPreset = (preset) => {
    setValues(preset.values);
    setResult(null);
    setStatus('idle');
    setTriedRun(false);
  };

  // A child, or an impossible height/weight pair: explained, never sent.
  const blocked = patientError(values);

  const run = async (e) => {
    e.preventDefault();
    setTriedRun(true);
    if (blocked) {
      document.getElementById('pr-blocked')?.focus();
      return;
    }
    if (troponinError(values)) {
      document.getElementById('pr-troponin')?.focus();
      return;
    }
    if (!signedIn) {
      keepPending({ values, payload });
      onRequireLogin?.();
      return;
    }
    setStatus('loading');
    setJustSaved(false);
    try {
      const data = await predict(payload);
      setResult({ data, payload });
      setJustSaved(true);
      // The nav bell and the Guidance page follow the newest assessment.
      notifications?.setLatest({ inputs: payload, result: data, created_at: new Date().toISOString() });
      setStatus('idle');
    } catch (err) {
      setError(err?.message ?? '');
      setStatus('error');
    }
  };

  const saveNote =
    result && justSaved && !stale && status !== 'loading' ? (
      <p className="pc-pr-save">Saved to your History.</p>
    ) : null;

  const section = (id) => SECTIONS.find((s) => s.id === id);
  const sliders = (id) =>
    section(id).fields.map((field) => (
      <SliderField
        key={field.key}
        field={field}
        value={values[field.key]}
        fallback={DEFAULTS[field.key]}
        onChange={set(field.key)}
      />
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
            {/* Word by word: each rises out of a soft blur, then a light sweeps the bold phrase (Prediction.css). */}
            <h1 className="pc-pr-title">
              {TITLE.map(([word, weight], i) => (
                <span key={word}>
                  {i > 0 && ' '}
                  <span className={`pc-pr-word pc-${weight}`} style={{ '--i': i }}>
                    {word}
                  </span>
                </span>
              ))}
            </h1>
            <p className="pc-pr-sub pc-enter" style={{ '--d': '200ms' }}>
              {USE_MOCK
                ? 'Enter the patient’s clinical values. In demo mode a simple built-in formula gives an illustrative score; it is not the trained model.'
                : 'Enter the patient’s clinical values. The model estimates the probability of heart disease from the same measurements it was trained on. Mark any lab you don’t have as “Not measured”.'}
            </p>
          </div>

          <div className="pc-pr-presets pc-enter" style={{ '--d': '140ms' }} role="group" aria-labelledby="pr-presets">
            <span id="pr-presets" className="pc-pr-presets-label">
              Sample inputs
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="pc-filter"
                aria-pressed={activePreset === p.id}
                title={p.description}
                onClick={() => loadPreset(p)}
              >
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
                      {Number.isFinite(bmi) ? bmi.toFixed(1) : '—'} <span>kg/m²</span>
                    </dd>
                    <dd className="pc-pr-derived-note">
                      {bmi < BMI_TRAIN[0] || bmi > BMI_TRAIN[1]
                        ? `Beyond the training data (${BMI_TRAIN[0]}–${BMI_TRAIN[1]})`
                        : 'From height and weight'}
                    </dd>
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
                // A bad value is flagged as it's typed; an empty field only once Run is pressed.
                error={triedRun || values.troponin !== '' ? troponinError(values) : ''}
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

          <ResultCard
            status={status}
            data={result?.data}
            stale={stale}
            error={error}
            notification={notification}
            LinkComponent={LinkComponent}
            saveNote={saveNote}
            signedIn={signedIn}
            blocked={blocked}
          />
        </form>
      </main>
      <SiteFooter LinkComponent={LinkComponent} activePath={activePath} />
    </div>
  );
}
