import { linkProps } from '../../../components/link';

const LEVELS = {
  low: { label: 'Low', className: 'is-low' },
  moderate: { label: 'Moderate', className: 'is-moderate' },
  high: { label: 'High', className: 'is-high' },
};

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const SHOWN = 3;

const pct = (p) => {
  const n = Math.round(p * 100);
  return n < 1 ? '<1' : n > 99 ? '>99' : n;
};

/**
 * The user's own latest assessments (GET /api/history/), newest first.
 * A new account has none yet: it says so and points to the first prediction.
 */
export default function AssessmentsCard({ records = [], LinkComponent = 'a' }) {
  const L = LinkComponent;
  const latest = records.slice(-SHOWN).reverse();

  return (
    <article className="pc-checkups pc-assess pc-enter" style={{ '--d': '360ms', '--pc-rise': '60px' }}>
      <div className="pc-checkups-head">
        <h2 className="pc-checkups-title">Your assessments</h2>
        <span className="pc-count">{records.length} saved</span>
      </div>

      {latest.length ? (
        <>
          <ul className="pc-assess-list">
            {latest.map((r) => {
              const level = LEVELS[r.result.risk_level] ?? LEVELS.low;
              return (
                <li key={r.id}>
                  <div>
                    <p className="pc-assess-id">{r.id}</p>
                    <p className="pc-assess-date">{dateFmt.format(new Date(r.created_at))}</p>
                  </div>
                  <span className="pc-assess-pct">
                    {pct(r.result.probability)}
                    <small>%</small>
                  </span>
                  <span className={`pc-badge ${level.className}`}>{level.label}</span>
                </li>
              );
            })}
          </ul>
          <L {...linkProps(L, '/history')} className="pc-assess-link">
            See all in History →
          </L>
        </>
      ) : (
        <div className="pc-assess-empty">
          <p>No predictions yet. Your results appear here once you run your first one.</p>
          <L {...linkProps(L, '/prediction')} className="pc-assess-link">
            Run a prediction →
          </L>
        </div>
      )}
    </article>
  );
}
