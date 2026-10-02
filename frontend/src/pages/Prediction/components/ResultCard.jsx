import { AlertGroups, GuidanceLink, RiskNotice } from '../../../notifications/Alerts';
import { USE_MOCK } from '../../../api/mode';
import { pctText } from '../../../clinical/risk';
import heartArt from '../../../assets/prediction-heart.webp';

const LEVELS = {
  low: { label: 'Low risk', className: 'is-low', stroke: 'var(--pc-mint)' },
  moderate: { label: 'Moderate risk', className: 'is-moderate', stroke: 'var(--pc-sun)' },
  high: { label: 'High risk', className: 'is-high', stroke: 'var(--pc-rose)' },
};

const RING = 2 * Math.PI * 42;

function Gauge({ probability, stroke }) {
  const has = typeof probability === 'number';
  // Never show a flat 0% or 100%: a model estimate is never certain.
  const pct = has ? Math.round(probability * 100) : null;
  const shown = pct === null ? '—' : pct < 1 ? '<1' : pct > 99 ? '>99' : pct;

  return (
    <div className="pc-pr-gauge">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" className="pc-pr-gauge-track" />
        <circle
          cx="50"
          cy="50"
          r="42"
          className="pc-pr-gauge-arc"
          stroke={stroke}
          strokeDasharray={RING}
          strokeDashoffset={RING * (1 - (has ? probability : 0))}
        />
      </svg>
      <div className="pc-pr-gauge-center">
        <span className="pc-pr-gauge-value">
          {shown}
          {has && <span className="pc-risk-unit">%</span>}
        </span>
      </div>
    </div>
  );
}

/** What the estimate was made without, and whether to trust it less (QA H2/H3). */
export function MissingNote({ data }) {
  const missing = data?.missing_fields ?? [];
  if (!missing.length) return null;
  return (
    <p className={`pc-pr-missing-note${data.low_confidence ? ' is-low' : ''}`}>
      {data.low_confidence && <strong>Low confidence. </strong>}
      Estimated without {missing.join(', ')}: the model filled {missing.length === 1 ? 'it' : 'them'} in from typical
      values.{data.low_confidence ? ' Add the missing labs for a more reliable estimate.' : ''}
    </p>
  );
}

/** Values beyond what the model was trained on: it treats them like the nearest value it saw. */
export function OutsideNote({ data }) {
  const items = data?.outside_training ?? [];
  if (!items.length) return null;
  const describe = (o) =>
    `${o.name} ${o.value.toLocaleString()} ${o.unit} (${o.value > o.max ? `highest seen ${o.max.toLocaleString()}` : `lowest seen ${o.min.toLocaleString()}`})`;
  return (
    <p className="pc-pr-missing-note is-low">
      <strong>Beyond the training data. </strong>
      {items.map(describe).join('; ')}. The model treats {items.length === 1 ? 'it' : 'these'} like the nearest
      value it saw, so this estimate is less reliable.
    </p>
  );
}

/** Estimates made before the model was retrained used Troponin-I backwards (QA C1). */
export function TroponinCaveat({ factors }) {
  if (!factors?.some((f) => f.name === 'Troponin-I')) return null;
  return (
    <p className="pc-pr-missing-note is-low">
      <strong>Older model. </strong>This estimate came from a model version that used Troponin-I in the reverse of its
      clinical meaning. Run it again for an estimate from the current model.
    </p>
  );
}

function FactorList({ factors }) {
  const biggest = Math.max(...factors.map((f) => Math.abs(f.contribution)), 0.0001);

  return (
    <div className="pc-pr-factors">
      <h3 className="pc-pr-eyebrow">What moved this estimate</h3>
      <ul>
        {factors.map((f) => {
          const up = f.contribution > 0;
          return (
            <li key={f.name}>
              <div className="pc-pr-factor-top">
                <span>{f.name}</span>
                <span className={up ? 'is-up' : 'is-down'}>
                  {up ? 'raised' : 'lowered'} {Math.abs(f.contribution * 100).toFixed(1)} pts
                </span>
              </div>
              <span className="pc-pr-bar" aria-hidden="true">
                <span
                  className={up ? 'is-up' : 'is-down'}
                  style={{ width: `${(Math.abs(f.contribution) / biggest) * 100}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Right-hand result panel. Holds the form's submit button, so running the
 * model always happens next to the number it produces.
 */
export default function ResultCard({
  status,
  data,
  stale,
  error,
  notification,
  LinkComponent,
  saveNote,
  signedIn = true,
  blocked = '',
  blockedTitle = 'No estimate for this patient. ',
  onBlockedClick,
}) {
  const level = data ? LEVELS[data.risk_level] : null;
  const loading = status === 'loading';
  // Before the first estimate the card would be bare: show the glass-anatomy
  // heart behind it, faded and foggy (decoration only, see Prediction.css).
  const empty = !data && !loading;

  return (
    <aside
      className={`pc-pr-result pc-enter${empty ? ' is-empty' : ''}`}
      style={{ '--d': '200ms', '--pr-art': `url(${heartArt})` }}
      aria-labelledby="pr-result-title"
    >
      <div className="pc-pr-result-head">
        <h2 id="pr-result-title" className="pc-pr-eyebrow">
          {USE_MOCK ? 'Illustrative score (demo)' : 'Model estimate'}
        </h2>
        {level && <span className={`pc-badge ${level.className}`}>{level.label}</span>}
        {data && !level && <span className="pc-badge">{data.risk_level}</span>}
      </div>

      <div aria-live="polite" className={`pc-pr-result-body${stale || loading ? ' is-dim' : ''}`}>
        <Gauge probability={data?.probability} stroke={level?.stroke ?? '#fff'} />
        <p className="pc-pr-gauge-label">Estimated probability of heart disease</p>
        {data ? (
          <p className="pc-visually-hidden">
            Estimated probability of heart disease {pctText(data.probability)} percent,{' '}
            {level?.label ?? data.risk_level}.
          </p>
        ) : (
          <p className="pc-pr-empty">Fill in the patient's values, then run the model to see an estimate.</p>
        )}
      </div>

      {/* Only this middle part scrolls, so the button never leaves the card on short screens. */}
      {(stale || data) && (
        <div className="pc-pr-result-scroll">
          {stale && !loading && (
            <p className="pc-pr-stale">Inputs changed since this estimate. Run it again to update.</p>
          )}
          <MissingNote data={data} />
          <OutsideNote data={data} />
          <TroponinCaveat factors={data?.top_factors} />
          {/* Keyed per result so a new estimate re-announces and re-animates. */}
          {notification && (
            <div key={data?.probability} className="pc-pr-alerts">
              <RiskNotice risk={notification.risk} live />
              <AlertGroups groups={notification.groups} limit={4} />
              {notification.needsAttention && <GuidanceLink LinkComponent={LinkComponent} />}
            </div>
          )}
          {/* Keyed per result so each new estimate glides in. */}
          {data?.top_factors?.length > 0 && <FactorList key={data.probability} factors={data.top_factors} />}
        </div>
      )}

      {saveNote}

      <p className="pc-pr-disclaimer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3 3 19h18L12 3Z" strokeLinejoin="round" />
          <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
        </svg>
        <span>
          Research prototype. Not externally validated, not approved for clinical use. This is a model
          estimate, not a diagnosis.
        </span>
      </p>

      {blocked && (
        <p id="pr-blocked" tabIndex={-1} className="pc-pr-missing-note is-low" role="alert">
          <strong>{blockedTitle}</strong>
          {blocked}
          {onBlockedClick && (
            <>
              {' '}
              <button type="button" className="pc-pr-inline-link" onClick={onBlockedClick}>
                Go to the field
              </button>
            </>
          )}
        </p>
      )}

      {status === 'error' && (
        <p className="pc-pr-error" role="alert">
          Couldn't get a prediction. {error}
        </p>
      )}

      <button type="submit" className="pc-pr-run" disabled={loading || Boolean(blocked)}>
        {loading ? 'Running model…' : !signedIn ? 'Log in to run prediction' : data ? 'Run again' : 'Run prediction'}
        <span className="pc-hero-cta-arrow" aria-hidden="true">
          →
        </span>
      </button>
      {!loading && !blocked && signedIn && (
        <p className="pc-pr-shortcut" aria-hidden="true">
          or press <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</kbd> + <kbd>Enter</kbd>
        </p>
      )}
    </aside>
  );
}
