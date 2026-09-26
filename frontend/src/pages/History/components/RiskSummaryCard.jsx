import CountUp from '../../About/components/CountUp';
import { LEVELS, pct } from '../board';

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/** "Risk estimate": latest vs first estimate, and a pill meter that fills to the latest value. */
export default function RiskSummaryCard({ records, ready }) {
  const first = records[0];
  const latest = records.at(-1);
  const now = pct(latest);
  const then = pct(first);
  const delta = now - then;
  const level = LEVELS[latest.result.risk_level];

  return (
    <article className="pc-h-tile pc-enter" style={{ '--d': '220ms' }} aria-labelledby="h-risk-title">
      <header className="pc-h-tile-head">
        <span className="pc-h-tile-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12h4l2-5 4 10 2-5h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 id="h-risk-title" className="pc-h-tile-title">Risk estimate</h2>
      </header>

      <div className="pc-h-compare">
        <div className="pc-h-compare-col is-latest">
          <span className="pc-h-compare-label">Latest</span>
          <span className="pc-h-compare-value">
            <CountUp value={now} start={ready} suffix="%" />
            {records.length > 1 && delta !== 0 && (
              <span className={`pc-h-trend-chip ${delta < 0 ? 'is-down' : 'is-up'}`}>
                <span aria-hidden="true">{delta < 0 ? '↘' : '↗'}</span>
                <span className="pc-visually-hidden">{delta < 0 ? 'down' : 'up'}</span> {Math.abs(delta)} pts
              </span>
            )}
          </span>
          <span className="pc-h-compare-note">{dateFmt.format(new Date(latest.created_at))}</span>
        </div>
        <div className="pc-h-compare-col">
          <span className="pc-h-compare-label">First</span>
          <span className="pc-h-compare-value is-muted">
            <CountUp value={then} start={ready} suffix="%" />
          </span>
          <span className="pc-h-compare-note">{dateFmt.format(new Date(first.created_at))}</span>
        </div>
      </div>

      <div
        className="pc-h-pill"
        role="meter"
        aria-label="Latest risk estimate"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={now}
      >
        <span className={`pc-h-pill-fill ${level?.className ?? ''}`} style={{ '--value': `${now}%` }}>
          <span aria-hidden="true">{now}%</span>
        </span>
        <span className="pc-h-pill-label">{level?.label ?? latest.result.risk_level}</span>
      </div>
    </article>
  );
}
