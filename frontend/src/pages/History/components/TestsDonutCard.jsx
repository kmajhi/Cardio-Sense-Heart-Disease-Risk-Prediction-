import { useState } from 'react';
import CountUp from '../../About/components/CountUp';
import { groupSummary, panel, statusCounts } from '../board';

const GAP = 1.6; // surface gap between segments, in pathLength units (of 100)
const SHORT = { Vitals: 'Vitals', Lipids: 'Lipids', 'Blood panel': 'Blood', 'Cardiac marker': 'Cardiac' };

/**
 * "Latest test results": a donut of the newest panel by status. Segments draw
 * in one after another on load; hovering a segment or legend row shows its
 * count in the middle.
 */
export default function TestsDonutCard({ record, ready }) {
  const rows = panel(record);
  const counts = statusCounts(rows);
  const total = rows.length;
  const inRange = counts.find((s) => s.key === 'ok')?.count ?? 0;
  const [active, setActive] = useState(null);
  const shown = counts.find((s) => s.key === active);

  let start = 0;
  const segments = counts.map((s, i) => {
    const len = (s.count / total) * 100;
    const seg = { ...s, i, len: counts.length > 1 ? Math.max(len - GAP, 0.6) : 100, offset: start + (counts.length > 1 ? GAP / 2 : 0) };
    start += len;
    return seg;
  });

  return (
    <article className="pc-h-tile pc-enter" style={{ '--d': '340ms' }} aria-labelledby="h-donut-title">
      <header className="pc-h-tile-head">
        <span className="pc-h-tile-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 id="h-donut-title" className="pc-h-tile-title">Latest test results</h2>
      </header>

      <div className="pc-h-donut-wrap" onMouseLeave={() => setActive(null)}>
        <div className={`pc-h-donut${active ? ' has-active' : ''}`}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="40" className="pc-h-donut-track" />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r="40"
                pathLength="100"
                className={`pc-h-donut-seg is-${s.key}${active === s.key ? ' is-active' : ''}`}
                style={{ '--len': s.len, '--i': s.i }}
                strokeDashoffset={-s.offset}
                onMouseEnter={() => setActive(s.key)}
              />
            ))}
          </svg>
          <div className="pc-h-donut-center">
            {shown ? (
              <span className="pc-h-donut-swap" key={shown.key}>
                <strong>{shown.count}</strong>
                <span>{shown.label.toLowerCase()}</span>
              </span>
            ) : (
              <span className="pc-h-donut-swap" key="all">
                <strong>
                  <CountUp value={inRange} start={ready} />
                  <small>/{total}</small>
                </strong>
                <span>in range</span>
              </span>
            )}
          </div>
        </div>

        <ul className="pc-h-legend" aria-label="Results by status">
          {counts.map((s) => (
            <li
              key={s.key}
              className={`is-${s.key}${active === s.key ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(s.key)}
            >
              <span className="pc-h-legend-dot" aria-hidden="true" />
              <span>{s.label}</span>
              <b>{s.count}</b>
            </li>
          ))}
        </ul>
      </div>

      <ul className="pc-h-groups" aria-label="Results by panel">
        {groupSummary(rows).map((g, i) => (
          <li key={g.group} className={g.flagged ? 'is-flagged' : ''} style={{ '--i': i }}>
            <span className="pc-h-group-name">{SHORT[g.group] ?? g.group}</span>
            <span className="pc-h-group-state">
              {g.flagged ? `${g.flagged} flagged` : 'All clear'}
              <span className="pc-visually-hidden">
                {' '}
                of {g.total} {g.group} results
              </span>
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
