import { linkProps } from '../link';

const LEVELS = {
  low: { label: 'Low risk', className: 'is-low' },
  moderate: { label: 'Moderate risk', className: 'is-moderate' },
  high: { label: 'High risk', className: 'is-high' },
};

export default function RiskCard({ risk, LinkComponent }) {
  const L = LinkComponent;
  const pct = Math.round(risk.probability * 100);
  const level = LEVELS[risk.level] ?? LEVELS.low;

  return (
    <article className="pc-glass pc-risk pc-enter" style={{ '--d': '280ms', '--pc-rise': '60px' }}>
      <h2 className="pc-card-title">Risk prediction</h2>

      <div className="pc-risk-score">
        <span className="pc-risk-value">
          {pct}
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
        Based on your latest clinical inputs. Model confidence {Math.round(risk.confidence * 100)}%.
      </p>

      {risk.factors?.length > 0 && (
        <ul className="pc-tags" aria-label="Main contributing factors">
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
