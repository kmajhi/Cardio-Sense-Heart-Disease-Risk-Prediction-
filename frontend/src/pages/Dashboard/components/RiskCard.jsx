import { linkProps } from '../../../components/link';

const LEVELS = {
  low: { label: 'Low risk', className: 'is-low' },
  moderate: { label: 'Moderate risk', className: 'is-moderate' },
  high: { label: 'High risk', className: 'is-high' },
};

export default function RiskCard({ risk, LinkComponent }) {
  const L = LinkComponent;

  if (!risk) {
    return (
      <article className="pc-glass pc-risk pc-enter" style={{ '--d': '280ms', '--pc-rise': '60px' }}>
        <h2 className="pc-card-title">Risk prediction</h2>
        <p className="pc-risk-note">
          No assessment yet. Enter a patient's clinical values to get an explained risk estimate.
        </p>
        <L {...linkProps(L, '/prediction')} className="pc-btn-glass">
          Run first prediction
          <span className="pc-btn-plus" aria-hidden="true">+</span>
        </L>
      </article>
    );
  }

  const pct = Math.round(risk.probability * 100);
  const level = LEVELS[risk.level] ?? LEVELS.low;

  return (
    <article className="pc-glass pc-risk pc-enter" style={{ '--d': '280ms', '--pc-rise': '60px' }}>
      <h2 className="pc-card-title">Risk prediction</h2>

      <div className="pc-risk-score">
        <span className="pc-risk-value">
          {/* Never a flat 0% or 100%: a model estimate is never certain (same as the Prediction page). */}
          {pct < 1 ? '<1' : pct > 99 ? '>99' : pct}
          <span className="pc-risk-unit">%</span>
        </span>
        <span className={`pc-badge ${level.className}`}>{level.label}</span>
      </div>

      <div
        className="pc-meter"
        role="meter"
        aria-label="Estimated heart disease risk"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className="pc-meter-fill" style={{ '--value': `${pct}%` }} />
      </div>

      <p className="pc-risk-note">
        {risk.id ? `Latest assessment, ${risk.id}. ` : 'Based on the latest clinical inputs. '}
        A model estimate, not a diagnosis.
      </p>

      {risk.factors?.length > 0 && (
        <ul className="pc-tags" aria-label="Factors that raised the estimate">
          {risk.factors.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      <L {...linkProps(L, '/prediction')} className="pc-btn-glass">
        Run new prediction
        <span className="pc-btn-plus" aria-hidden="true">+</span>
      </L>
    </article>
  );
}
