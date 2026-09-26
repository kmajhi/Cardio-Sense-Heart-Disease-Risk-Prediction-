import { BANDS, LEVELS, pct } from '../board';

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });
const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * "Risk over time": one rounded bar per assessment, growing up from the
 * baseline in order on load. Hover or focus a bar for its date and value.
 */
export default function RiskBarsCard({ records }) {
  const latest = records.at(-1);

  return (
    <article className="pc-h-tile pc-enter" style={{ '--d': '280ms' }} aria-labelledby="h-bars-title">
      <header className="pc-h-tile-head">
        <span className="pc-h-tile-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 20V11M12 20V5M19 20v-6" strokeLinecap="round" />
          </svg>
        </span>
        <h2 id="h-bars-title" className="pc-h-tile-title">Risk over time</h2>
        <span className="pc-h-tile-meta">{records.length} tests</span>
      </header>

      <div className="pc-h-bars-top">
        <span>Estimate per assessment</span>
        <span>Latest {pct(latest)}%</span>
      </div>

      <div className="pc-h-bars-plot">
        {BANDS.map((b) => (
          <span key={b.at} className="pc-h-band" style={{ '--at': b.at }} aria-hidden="true">
            <span>{b.label}</span>
          </span>
        ))}
        <ol className="pc-h-bars" aria-label="Risk estimate per assessment, oldest first">
          {records.map((rec, i) => {
            const value = pct(rec);
            const date = new Date(rec.created_at);
            const level = LEVELS[rec.result.risk_level];
            return (
              <li
                key={rec.id}
                className={`pc-h-bar${i === records.length - 1 ? ' is-latest' : ''}`}
                style={{ '--h': value / 100, '--i': i }}
                tabIndex={0}
                aria-label={`${dayFmt.format(date)}: ${value}%, ${level?.label ?? rec.result.risk_level}`}
              >
                <span className="pc-h-bar-track" aria-hidden="true">
                  <span className="pc-h-bar-fill" />
                </span>
                <span className="pc-h-bar-tip" aria-hidden="true">
                  <strong>{value}%</strong>
                  {dayFmt.format(date)}
                </span>
                <span className="pc-h-bar-month" aria-hidden="true">
                  {monthFmt.format(date)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </article>
  );
}
