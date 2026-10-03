import { useEffect, useMemo, useRef, useState } from 'react';
import NavBar from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
import SliderField from './components/SliderField';
import Segmented from './components/Segmented';
import TroponinField from './components/TroponinField';
import ResultCard from './components/ResultCard';
import FieldHelp from './components/FieldHelp';
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
import { INFO, PAYLOAD_KEY, levelsFor, trackBands } from './fieldInfo';
import { USE_MOCK } from '../../api/mode';
import { linkProps } from '../../components/link';
import { analyze } from '../../clinical/analyze';
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
// Values typed in this tab, kept if the page is reloaded or left by accident.
// Session storage only: health data never outlives the browser tab.
const DRAFT_KEY = 'cardio-sense:prediction-draft';
// Which unit each lab is shown in. A preference, not health data.
const UNITS_KEY = 'cardio-sense:lab-units';

function readSession(key, { remove = false } = {}) {
  try {
    const raw = sessionStorage.getItem(key);
    if (remove) sessionStorage.removeItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: nothing is kept, which is fine */
  }
}

function readUnits() {
  try {
    return JSON.parse(localStorage.getItem(UNITS_KEY)) ?? {};
  } catch {
    return {};
  }
}

const YES_NO = [
  [0, 'No'],
  [1, 'Yes'],
];

const same = (a, b) => Object.keys(b).every((k) => a[k] === b[k]);

// The section each analysed value belongs to, for the "to review" counts.
const SECTION_OF = {
  bmi: 'profile',
  family_history: 'history',
  hypertension: 'history',
  diabetes: 'history',
  chest_pain_history: 'history',
  bp_mmhg: 'vitals',
  rbs_mmol_l: 'vitals',
  total_cholesterol: 'lipids',
  hdl: 'lipids',
  ldl: 'lipids',
  triglycerides: 'lipids',
  hemoglobin: 'blood',
  creatinine: 'blood',
  platelets: 'blood',
  sodium: 'blood',
  potassium: 'blood',
  chloride: 'blood',
  troponin_i: 'troponin',
};

const NAV = [
  { id: 'profile', label: 'Profile' },
  { id: 'history', label: 'History' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'lipids', label: 'Lipids' },
  { id: 'blood', label: 'Blood panel' },
  { id: 'troponin', label: 'Troponin' },
];

const ICON = {
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  history: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  vitals: 'M3 12h4l2-6 4 12 2-6h6',
  lipids: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  blood: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 14h9',
  troponin: 'M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11ZM8 11h2l1-2 2 4 1-2h2',
};

const SectionIcon = ({ id }) => (
  <span className="pc-pr-sec-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON[id]} />
    </svg>
  </span>
);

function SectionHead({ id, title, hint, review }) {
  return (
    <header className="pc-pr-card-head">
      <SectionIcon id={id} />
      <div>
        <h2 id={`pr-s-${id}`} className="pc-pr-card-title">
          {title}
        </h2>
        {hint && <p className="pc-pr-card-hint">{hint}</p>}
      </div>
      {review > 0 && (
        <span className="pc-pr-review" title="Values outside the healthy range">
          {review} to review
        </span>
      )}
    </header>
  );
}

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
  const [restored, setRestored] = useState(false);
  const [units, setUnits] = useState(readUnits);
  const [activeSection, setActiveSection] = useState('profile');
  const [invalid, setInvalid] = useState({}); // field key → why its typed value can't be used
  const notifications = useNotifications();
  const formRef = useRef(null);

  // Back from logging in to run a prediction: restore the values and run it now.
  // Otherwise bring back an unsaved draft from earlier in this tab.
  useEffect(() => {
    const pending = signedIn ? readSession(PENDING_KEY, { remove: true }) : null;
    if (!pending) {
      const draft = readSession(DRAFT_KEY);
      if (draft?.values && !same(draft.values, DEFAULTS)) {
        setValues({ ...DEFAULTS, ...draft.values });
        setRestored(true);
      }
      return;
    }
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

  // Keep the draft (and only while it differs from the starting values).
  useEffect(() => {
    const id = setTimeout(() => writeSession(DRAFT_KEY, same(values, DEFAULTS) ? null : { values, at: Date.now() }), 400);
    return () => clearTimeout(id);
  }, [values]);

  useEffect(() => {
    try {
      localStorage.setItem(UNITS_KEY, JSON.stringify(units));
    } catch {
      /* preference only */
    }
  }, [units]);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Scroll-spy: highlight the section being filled in.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.dataset.section);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    formRef.current?.querySelectorAll('[data-section]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));

  const payload = useMemo(() => toPayload(values), [values]);
  // Live clinical reading of every value as it's entered (the same checks the result uses).
  const analysis = useMemo(() => analyze(payload), [payload]);
  const reviewCounts = useMemo(() => {
    const counts = {};
    for (const f of analysis.flagged) {
      const s = SECTION_OF[f.key];
      if (s) counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [analysis]);
  const toReview = analysis.flagged.length;

  const stale = result !== null && JSON.stringify(result.payload) !== JSON.stringify(payload);
  // Model risk + values outside healthy ranges, for the inputs the estimate was made from.
  const notification = useMemo(
    () => (result ? buildNotification({ inputs: result.payload, result: result.data }) : null),
    [result],
  );
  const bmi = bmiFrom(values.height, values.weight);
  const bmiFinding = analysis.find('bmi');
  // The sample the form still matches exactly; editing any value deselects it.
  const activePreset = PRESETS.find((p) => same(values, p.values))?.id;
  const maxHR = maxHRFrom(values.age, values.sex);

  const loadPreset = (preset) => {
    setValues(preset.values);
    setResult(null);
    setStatus('idle');
    setTriedRun(false);
    setRestored(false);
  };

  const reset = () => {
    setValues(DEFAULTS);
    setResult(null);
    setStatus('idle');
    setTriedRun(false);
    setRestored(false);
  };

  // A child, or an impossible height/weight pair: explained, never sent.
  const blocked = patientError(values);
  // Typed values outside their allowed range: the run waits until they're fixed.
  const problems = Object.values(invalid).filter(Boolean);
  const inputError =
    problems.length === 0
      ? ''
      : problems.length === 1
        ? problems[0]
        : `${problems.length} values are outside their allowed range: ${problems.map((m) => m.split(/ must| ?:/)[0]).join(', ')}. Fix them to run the prediction.`;
  const focusFirstInvalid = () => document.querySelector('.pc-pr-inputs [aria-invalid="true"]')?.focus();

  const run = async (e) => {
    e?.preventDefault();
    setTriedRun(true);
    if (inputError) {
      focusFirstInvalid();
      return;
    }
    if (blocked) {
      document.getElementById('pr-blocked')?.focus();
      return;
    }
    if (troponinError(values)) {
      document.getElementById('pr-troponin')?.focus();
      return;
    }
    if (!signedIn) {
      writeSession(PENDING_KEY, { values, payload });
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

  // Ctrl/⌘ + Enter runs the model from anywhere in the form.
  const onFormKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && status !== 'loading') run(e);
  };

  const saveNote =
    result && justSaved && !stale && status !== 'loading' ? (
      <p className="pc-pr-save">Saved to your History.</p>
    ) : null;

  // ---- per-field helpers ----
  const findingFor = (key) => (PAYLOAD_KEY[key] ? analysis.find(PAYLOAD_KEY[key]) : null);
  const statusFor = (key) => {
    const f = findingFor(key);
    return f && f.status !== 'missing' && f.band ? { level: f.level, band: f.band } : null;
  };
  const help = (key, current) => (
    <FieldHelp info={INFO[key]} levels={levelsFor(key, { sex: values.sex, assay: values.troponinAssay })} current={current} />
  );
  const currentFor = (key) => {
    const f = findingFor(key);
    return f?.band && f.status !== 'missing' ? { display: f.display, unit: f.unit, band: f.band } : null;
  };

  const section = (id) => SECTIONS.find((s) => s.id === id);
  const sliders = (id) =>
    section(id).fields.map((field) => {
      const f = findingFor(field.key);
      return (
        <SliderField
          key={field.key}
          field={field}
          value={values[field.key]}
          fallback={DEFAULTS[field.key]}
          onChange={set(field.key)}
          help={help(field.key, currentFor(field.key))}
          status={statusFor(field.key)}
          healthy={f?.range}
          bands={trackBands(field.key, values.sex)}
          units={field.units}
          unitIndex={units[field.key] ?? 0}
          onUnit={(i) => setUnits((u) => ({ ...u, [field.key]: i }))}
          onInvalid={(message) => setInvalid((all) => (all[field.key] === message ? all : { ...all, [field.key]: message }))}
        />
      );
    });

  return (
    <div className={`pc-dash pc-predict${ready ? ' is-ready' : ''}`}>
      <NavBar user={user} hasNotifications={hasNotifications} activePath={activePath} LinkComponent={LinkComponent} />

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
                : 'Enter the patient’s values from their latest check-up and lab report. Tap ? beside any field to see what it is, where to find it and its healthy levels.'}
            </p>
            <LinkComponent {...linkProps(LinkComponent, '/about#a-tests')} className="pc-pr-guide pc-enter" style={{ '--d': '260ms' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 14h9" />
              </svg>
              Input guide: which tests do I need?
              <span aria-hidden="true">→</span>
            </LinkComponent>
          </div>

          <div className="pc-pr-presets pc-enter" style={{ '--d': '140ms' }} role="group" aria-labelledby="pr-presets">
            <span id="pr-presets" className="pc-pr-presets-label">
              Try a sample
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pc-filter is-${p.id}`}
                aria-pressed={activePreset === p.id}
                title={p.description}
                onClick={() => loadPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {restored && (
          <div className="pc-pr-restored" role="status">
            <span>Restored the values you entered earlier in this tab.</span>
            <button type="button" className="pc-pr-text-btn" onClick={reset}>
              Start over
            </button>
            <button type="button" className="pc-pr-text-btn" aria-label="Dismiss" onClick={() => setRestored(false)}>
              ×
            </button>
          </div>
        )}

        <form ref={formRef} className="pc-pr-grid" onSubmit={run} onKeyDown={onFormKey} noValidate>
          <div className="pc-pr-inputs">
            <nav className="pc-pr-nav pc-enter" style={{ '--d': '150ms' }} aria-label="Form sections">
              <ol>
                {NAV.map((n) => (
                  <li key={n.id}>
                    <a href={`#pr-sec-${n.id}`} className={activeSection === n.id ? 'is-active' : undefined} aria-current={activeSection === n.id ? 'step' : undefined}>
                      {n.label}
                      {reviewCounts[n.id] > 0 && <span className="pc-pr-nav-count">{reviewCounts[n.id]}</span>}
                    </a>
                  </li>
                ))}
              </ol>
              <span className={`pc-pr-nav-summary${toReview ? ' has-flags' : ''}`}>
                {toReview ? `${toReview} value${toReview === 1 ? '' : 's'} outside healthy ranges` : 'All values in healthy ranges'}
              </span>
              <button type="button" className="pc-pr-text-btn" onClick={reset} disabled={same(values, DEFAULTS) && !result}>
                Reset
              </button>
            </nav>

            <section id="pr-sec-profile" data-section="profile" className="pc-pr-card pc-enter" style={{ '--d': '160ms' }} aria-labelledby="pr-s-profile">
              <SectionHead id="profile" review={reviewCounts.profile} title={section('profile').title} hint={section('profile').hint} />
              <div className="pc-pr-fields pc-pr-fields--grid">
                <Segmented
                  id="pr-sex"
                  label="Sex"
                  options={[
                    ['M', 'Male'],
                    ['F', 'Female'],
                  ]}
                  value={values.sex}
                  onChange={set('sex')}
                  help={help('sex')}
                />
                {sliders('profile')}
              </div>
              <dl className="pc-pr-derived">
                <div>
                  <dt>
                    BMI {help('bmi', bmiFinding?.band ? { display: bmiFinding.display, unit: 'kg/m²', band: bmiFinding.band } : null)}
                  </dt>
                  <dd>
                    {Number.isFinite(bmi) ? bmi.toFixed(1) : '—'} <span>kg/m²</span>
                  </dd>
                  <dd className="pc-pr-derived-note">
                    {bmiFinding?.band && <span className={`pc-pr-chip is-${bmiFinding.level}`}><span aria-hidden="true" className="pc-pr-chip-dot" />{bmiFinding.band}</span>}
                    {bmi < BMI_TRAIN[0] || bmi > BMI_TRAIN[1] ? ` Beyond the training data (${BMI_TRAIN[0]}–${BMI_TRAIN[1]})` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Max heart rate {help('maxHR')}</dt>
                  <dd>
                    {Math.round(maxHR)} <span>bpm</span>
                  </dd>
                  <dd className="pc-pr-derived-note">Calculated: {maxHRFormula(values.sex)}</dd>
                </div>
              </dl>
            </section>

            <section id="pr-sec-history" data-section="history" className="pc-pr-card pc-enter" style={{ '--d': '200ms' }} aria-labelledby="pr-s-history">
              <SectionHead id="history" review={reviewCounts.history} title="Medical history" hint="Diagnosed conditions and symptoms, as the patient reports them" />
              <div className="pc-pr-fields pc-pr-fields--history">
                {HISTORY.map((h) => (
                  <Segmented
                    key={h.key}
                    id={`pr-${h.key}`}
                    label={h.label}
                    options={YES_NO}
                    value={values[h.key]}
                    onChange={set(h.key)}
                    help={help(h.key)}
                    inline
                  />
                ))}
              </div>
            </section>

            {['vitals', 'lipids', 'blood'].map((id, i) => (
              <section
                key={id}
                id={`pr-sec-${id}`}
                data-section={id}
                className="pc-pr-card pc-enter"
                style={{ '--d': `${240 + i * 40}ms` }}
                aria-labelledby={`pr-s-${id}`}
              >
                <SectionHead id={id} review={reviewCounts[id]} title={section(id).title} hint={section(id).hint} />
                <div className="pc-pr-fields pc-pr-fields--grid">{sliders(id)}</div>
              </section>
            ))}

            <section
              id="pr-sec-troponin"
              data-section="troponin"
              className="pc-pr-card pc-pr-card--marker pc-enter"
              style={{ '--d': '360ms' }}
              aria-labelledby="pr-s-troponin"
            >
              <SectionHead id="troponin" review={reviewCounts.troponin} title="Cardiac marker · Troponin-I" hint="Optional: only if a troponin test was done" />
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
                help={help('troponin', (() => {
                  const f = analysis.find('troponin_i');
                  return f?.band && f.status !== 'missing' ? { display: f.display, unit: f.unit, band: f.band } : null;
                })())}
                status={(() => {
                  const f = analysis.find('troponin_i');
                  return f?.band && f.status !== 'missing' && f.level ? { level: f.level, band: f.level === 'normal' ? 'Within limit' : 'Above limit' } : null;
                })()}
              />
            </section>
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
            blocked={inputError || blocked}
            blockedTitle={inputError ? 'Check the highlighted values. ' : undefined}
            onBlockedClick={inputError ? focusFirstInvalid : undefined}
          />
        </form>
      </main>
      <SiteFooter LinkComponent={LinkComponent} activePath={activePath} />
    </div>
  );
}
