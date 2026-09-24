import useReplay from './useReplay';

const W = 280;
const H = 130;
const PAD = 10;

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });

/**
 * "Risk over time": the headline blurs back in and the nodes pop in one by
 * one on hover, while the line itself stays put (as in the reference).
 */
export default function TrendCard({ records }) {
  const [replay, replayOn] = useReplay();
  const values = records.map((r) => r.result.probability);
  const pts = values.map((v, i) => [
    PAD + (i / Math.max(values.length - 1, 1)) * (W - 2 * PAD),
    PAD + (1 - v) * (H - 2 * PAD),
  ]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
  const area = `${line} L ${pts.at(-1)[0]} ${H} L ${pts[0][0]} ${H} Z`;

  const first = Math.round(values[0] * 100);
  const last = Math.round(values.at(-1) * 100);
  const delta = last - first;
  const since = monthFmt.format(new Date(records[0].created_at));
  const [lx, ly] = pts.at(-1);

  return (
    <article className="pc-h-feature" tabIndex={0} {...replayOn} aria-labelledby="h-trend-title">
      <div className="pc-h-art pc-h-art--trend" aria-hidden="true">
        <div className="pc-h-trend-head" key={`head-${replay}`}>
          <strong>
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}
            {Math.abs(delta)} pts
          </strong>
          <span>since {since}</span>
        </div>
        <div className="pc-h-trend-chart">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="pc-h-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6833e4" stopOpacity="0.18" />
                <stop offset="1" stopColor="#6833e4" stopOpacity="0" />
              </linearGradient>
            </defs>
            {pts.map(([x]) => (
              <line key={x} x1={x} x2={x} y1={0} y2={H} className="pc-h-trend-grid" />
            ))}
            <path d={area} fill="url(#pc-h-area)" />
            <path d={line} className="pc-h-trend-line" />
          </svg>
          {/* Nodes are HTML so they stay round under the stretched SVG. */}
          <div className="pc-h-trend-nodes" key={`nodes-${replay}`}>
            {pts.map(([x, y], i) => (
              <span
                key={i}
                className={`pc-h-node${i === pts.length - 1 ? ' is-last' : ''}`}
                style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, '--i': i }}
              />
            ))}
            <span
              className="pc-h-node-chip"
              style={{ left: `${(lx / W) * 100}%`, top: `${(ly / H) * 100}%`, '--i': pts.length }}
            >
              {last}%
            </span>
          </div>
        </div>
      </div>

      <h3 id="h-trend-title" className="pc-h-feature-title">Risk over time</h3>
      <p className="pc-h-feature-text">
        {records.length} assessments since {since}. The estimate went from {first}% to {last}%.
      </p>
    </article>
  );
}
