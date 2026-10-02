import { useEffect, useRef, useState } from 'react';
import usePrefersReducedMotion from '../../../hooks/usePrefersReducedMotion';
import { TOUR } from '../content';

const STEP_MS = 6000;

// ---------- the four screens, drawn in HTML (decorative: the step text says it all) ----------

function EnterScreen() {
  const rows = [
    ['Age', '52', 'years'],
    ['Systolic BP', '138', 'mmHg'],
    ['Total cholesterol', '226', 'mg/dL'],
    ['LDL', '148', 'mg/dL'],
    ['HDL', '38', 'mg/dL'],
  ];
  return (
    <div className="pc-t-screen pc-t-enter">
      <div className="pc-t-seg">
        <span className="is-on">Male</span>
        <span>Female</span>
      </div>
      {rows.map(([label, value, unit], i) => (
        <div key={label} className="pc-t-field" style={{ '--i': i }}>
          <span>{label}</span>
          <b>
            {value} <i>{unit}</i>
          </b>
        </div>
      ))}
      <div className="pc-t-field is-missing" style={{ '--i': rows.length }}>
        <span>Creatinine</span>
        <em>Not measured</em>
      </div>
      <span className="pc-t-cta">
        Run prediction <span aria-hidden="true">→</span>
      </span>
    </div>
  );
}

function CheckScreen() {
  const rows = [
    ['LDL', '148 mg/dL', 'Borderline high', 'warn'],
    ['HDL', '38 mg/dL', 'Low for men', 'warn'],
    ['Systolic BP', '138 mmHg', 'Stage 1 hypertension', 'warn'],
    ['Total cholesterol', '226 mg/dL', 'Borderline high', 'warn'],
    ['Hemoglobin', '14.1 g/dL', 'In range', 'ok'],
    ['Sodium', '139 mmol/L', 'In range', 'ok'],
  ];
  return (
    <div className="pc-t-screen pc-t-check">
      <p className="pc-t-label">Clinical range checks · 4 to review</p>
      {rows.map(([name, value, verdict, tone], i) => (
        <div key={name} className="pc-t-check-row" style={{ '--i': i }}>
          <span className={`pc-t-dot is-${tone}`} />
          <span className="pc-t-check-name">{name}</span>
          <span className="pc-t-check-val">{value}</span>
          <span className={`pc-t-chip is-${tone}`}>{verdict}</span>
        </div>
      ))}
    </div>
  );
}

function EstimateScreen() {
  const c = 2 * Math.PI * 52;
  const p = 0.46;
  return (
    <div className="pc-t-screen pc-t-estimate">
      <div className="pc-t-gauge">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" className="pc-t-gauge-track" />
          <circle cx="60" cy="60" r="52" className="pc-t-gauge-arc" strokeDasharray={c} style={{ '--off': c * (1 - p), '--full': c }} />
        </svg>
        <b>
          46<i>%</i>
        </b>
      </div>
      <span className="pc-t-band">Moderate risk</span>
      <div className="pc-t-scale">
        <span style={{ left: `${p * 100}%` }} />
      </div>
      <div className="pc-t-scale-labels">
        <span style={{ left: 0 }}>Low</span>
        <span style={{ left: '35%' }}>35%</span>
        <span style={{ left: '65%' }}>65%</span>
        <span style={{ left: '100%' }}>High</span>
      </div>
      <p className="pc-t-note">Confidence: normal · 1 lab estimated</p>
    </div>
  );
}

function ExplainScreen() {
  const factors = [
    ['LDL', 9.8, 'up'],
    ['Systolic BP', 6.1, 'up'],
    ['HDL', 4.4, 'up'],
    ['Age', 2.7, 'up'],
    ['Triglycerides', 3.2, 'down'],
  ];
  return (
    <div className="pc-t-screen pc-t-explain">
      <p className="pc-t-label">What moved the estimate</p>
      {factors.map(([name, pts, dir], i) => (
        <div key={name} className="pc-t-factor" style={{ '--i': i }}>
          <span>{name}</span>
          <span className="pc-t-factor-bar">
            <span className={`is-${dir}`} style={{ width: `${(pts / 10) * 100}%` }} />
          </span>
          <b className={`is-${dir}`}>
            {dir === 'up' ? '+' : '−'}
            {pts.toFixed(1)}
          </b>
        </div>
      ))}
      <div className="pc-t-saved">
        <span className="pc-t-saved-icon">✓</span>
        Saved to History · 3 guidance tips ready
      </div>
    </div>
  );
}

const SCREENS = { enter: EnterScreen, check: CheckScreen, estimate: EstimateScreen, explain: ExplainScreen };
const PAGES = { enter: 'Prediction', check: 'Prediction · range checks', estimate: 'Prediction · result', explain: 'History' };

/**
 * "How it works" as a guided tour: four steps on the left, a browser window on
 * the right that shows each step. Advances by itself until the reader picks a
 * step (or never, with reduced motion); pauses while hovered or off screen.
 */
export default function ProductTour({ inView }) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);
  const tabsRef = useRef([]);
  const running = auto && !reduced && inView && !hover;

  useEffect(() => {
    if (!running) return undefined;
    const id = setTimeout(() => setActive((a) => (a + 1) % TOUR.length), STEP_MS);
    return () => clearTimeout(id);
  }, [running, active]);

  const pick = (i) => {
    setAuto(false);
    setActive(i);
  };
  const onKey = (e) => {
    const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + TOUR.length) % TOUR.length;
    pick(next);
    tabsRef.current[next]?.focus();
  };

  const step = TOUR[active];
  const Screen = SCREENS[step.key];

  return (
    <div className={`pc-tour${inView ? ' is-in' : ''}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="pc-tour-steps" role="tablist" aria-label="How Cardio Sense works" aria-orientation="vertical" onKeyDown={onKey}>
        {TOUR.map((s, i) => (
          <button
            key={s.key}
            ref={(el) => (tabsRef.current[i] = el)}
            type="button"
            role="tab"
            id={`tour-tab-${s.key}`}
            aria-selected={i === active}
            aria-controls="tour-panel"
            tabIndex={i === active ? 0 : -1}
            className={`pc-tour-step${i === active ? ' is-active' : ''}`}
            onClick={() => pick(i)}
          >
            <span className="pc-tour-n">{String(i + 1).padStart(2, '0')}</span>
            <span className="pc-tour-body">
              <span className="pc-tour-title">
                {s.title}
                <span className="pc-tour-time">{s.time}</span>
              </span>
              <span className="pc-tour-text">{s.text}</span>
              {i === active && running && <span className="pc-tour-progress" style={{ '--ms': `${STEP_MS}ms` }} key={`p-${active}`} />}
            </span>
          </button>
        ))}
      </div>

      <div className="pc-tour-stage" id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${step.key}`}>
        <div className="pc-browser" aria-hidden="true">
          <div className="pc-browser-bar">
            <span className="pc-browser-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="pc-browser-url">Cardio Sense · {PAGES[step.key]}</span>
          </div>
          <div className="pc-browser-body" key={step.key}>
            <Screen />
          </div>
        </div>
        <p className="pc-tour-caption">
          Example patient, for illustration. Step {active + 1} of {TOUR.length}: {step.title.toLowerCase()}.
        </p>
      </div>
    </div>
  );
}
