import { USE_MOCK } from '../../../api/mode';
import RingLoader from '../../../components/RingLoader';
import { pctText } from '../../../clinical/risk';
import heartArt from '../../../assets/prediction-heart.webp';
import ReportButton from '../../../components/ReportButton';
import ResultInsights from './ResultInsights';

const LEVELS = {
  low: { label: 'Low risk', className: 'is-low', stroke: 'var(--pc-mint)' },
  moderate: { label: 'Moderate risk', className: 'is-moderate', stroke: 'var(--pc-sun)' },
  high: { label: 'High risk', className: 'is-high', stroke: 'var(--pc-rose)' },
};

const RING = 2 * Math.PI * 42;

function Gauge({ probability, stroke }) {
  const has = typeof probability === 'number';
  // Never show a flat 0% or 100%: a model estimate is never certain.
  const shown = has ? pctText(probability) : '—';

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
  report = null,
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
        {/* The previous estimate's band is hidden while a new one is computed. */}
        {level && !loading && <span className={`pc-badge ${level.className}`}>{level.label}</span>}
        {data && !level && !loading && <span className="pc-badge">{data.risk_level}</span>}
      </div>

      {loading ? (
        // While the model runs: the loading ring, with what is happening beneath it.
        <div className="pc-pr-loading" role="status" aria-live="polite">
          <RingLoader size={116} className="pc-pr-loading-ring" />
          <p className="pc-pr-loading-title">Running the prediction</p>
          <p className="pc-pr-loading-text">
            Analysing the patient’s measurements and checking each value against its reference range.
          </p>
          <span className="pc-pr-loading-note">This usually takes a few seconds.</span>
        </div>
      ) : (
      <div aria-live="polite" className={`pc-pr-result-body${stale ? ' is-dim' : ''}`}>
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
      )}

      {/* Only this middle part scrolls, so the button never leaves the card on short screens. */}
      {(stale || data) && !loading && (
        <div className="pc-pr-result-scroll">
          {stale && !loading && (
            <p className="pc-pr-stale">Inputs changed since this estimate. Run it again to update.</p>
          )}
          {/* Keyed per result so a new estimate starts on a fresh panel. */}
          <ResultInsights key={data?.probability} data={data} notification={notification} LinkComponent={LinkComponent} />
        </div>
      )}

      {saveNote}
      {/* The PDF for the saved assessment on screen; hidden while the inputs differ from it. */}
      {report && !stale && !loading && <ReportButton record={report} />}

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
