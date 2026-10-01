// Small, dependency-free SVG charts for the admin console.
// Colours (validated with the dataviz palette checks, light surface):
//   risk bands  low #1a9e70 · moderate #c98500 · high #e0457b  (amber < 3:1 → legend + table view always)
//   one series  #6833e4
// Marks: columns ≤ 24px, 4px rounded tops, square at the baseline, 2px surface
// gaps between stacked segments; hairline solid grid; hover tooltip per column.
import { useEffect, useRef, useState } from 'react';

export const RISK_COLORS = { low: '#1a9e70', moderate: '#c98500', high: '#e0457b' };
const RISK_LABELS = { low: 'Low', moderate: 'Moderate', high: 'High' };
const SERIES = '#6833e4';

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const day = (iso) => dayFmt.format(new Date(`${iso}T00:00:00`));

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Clean axis maximum and 3-4 ticks for counts. */
function ticks(max) {
  if (max <= 0) return { top: 4, values: [0, 2, 4] };
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => max / s <= 4) ?? Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  const values = [];
  for (let v = 0; v <= top; v += step) values.push(v);
  return { top, values };
}

/** Column path with a rounded top (r) and a square base. */
function column(x, y, w, h, r) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function Legend({ items }) {
  return (
    <ul className="ad-legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="ad-legend-key" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function ChartFrame({ title, legend, table, children }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="ad-chart">
      <div className="ad-chart-head">
        <figcaption>{title}</figcaption>
        <div className="ad-chart-tools">
          {legend}
          <button type="button" className="ad-link-btn" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? 'Show chart' : 'View as table'}
          </button>
        </div>
      </div>
      {asTable ? table : children}
    </figure>
  );
}

/**
 * Columns per day. `keys` are the stacked series (bottom → top) with their colours.
 * series: [{ date, ...counts }]
 */
function DailyColumns({ series, keys, colors, labels, height = 190 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 10, right: 8, bottom: 26, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const totals = series.map((d) => keys.reduce((s, k) => s + (d[k] || 0), 0));
  const { top, values } = ticks(Math.max(0, ...totals));
  const slot = innerW / series.length;
  const barW = Math.min(24, Math.max(4, slot * 0.62));
  const y = (v) => pad.top + innerH - (v / top) * innerH;
  const GAP = 2;

  return (
    <div className="ad-chart-plot" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Daily counts for the last 30 days">
        {values.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} className="ad-grid" />
            <text x={pad.left - 6} y={y(v)} className="ad-axis" textAnchor="end" dominantBaseline="middle">
              {v}
            </text>
          </g>
        ))}
        {series.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          let base = 0;
          const segs = keys.map((k, j) => {
            const v = d[k] || 0;
            if (!v) return null;
            const yTop = y(base + v);
            const yBottom = y(base);
            base += v;
            const isTop = keys.slice(j + 1).every((kk) => !(d[kk] || 0));
            // 2px surface gap between stacked segments: trim the top of every segment below another.
            const h = yBottom - yTop - (isTop ? 0 : GAP);
            return <path key={k} d={isTop ? column(x, yTop, barW, h, 4) : `M${x},${yTop + GAP} h${barW} v${h} h${-barW} Z`} fill={colors[k]} />;
          });
          return (
            <g key={d.date}>
              {segs}
              {/* Hit target: the whole slot, taller than the mark. */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {(i % 5 === 0 || i === series.length - 1) && (
                <text x={x + barW / 2} y={height - 8} className="ad-axis" textAnchor="middle">
                  {day(d.date)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="ad-baseline" />
      </svg>
      {hover !== null && (
        <div
          className="ad-tooltip"
          style={{ left: Math.min(width - 150, Math.max(0, pad.left + hover * slot + slot / 2 - 70)) }}
          role="status"
        >
          <strong>{day(series[hover].date)}</strong>
          {keys.map((k) => (
            <span key={k}>
              <i style={{ background: colors[k] }} aria-hidden="true" />
              {labels[k]}: {series[hover][k] || 0}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SeriesTable({ series, keys, labels }) {
  return (
    <div className="ad-table-wrap ad-chart-table">
      <table className="ad-table">
        <thead>
          <tr>
            <th>Day</th>
            {keys.map((k) => (
              <th key={k} style={{ textAlign: 'right' }}>
                {labels[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...series].reverse().map((d) => (
            <tr key={d.date}>
              <td>{day(d.date)}</td>
              {keys.map((k) => (
                <td key={k} style={{ textAlign: 'right' }}>
                  {d[k] || 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const BANDS = ['low', 'moderate', 'high'];

export function AssessmentsChart({ series }) {
  return (
    <ChartFrame
      title="Assessments per day, by risk band"
      legend={<Legend items={BANDS.map((k) => ({ label: RISK_LABELS[k], color: RISK_COLORS[k] }))} />}
      table={<SeriesTable series={series} keys={BANDS} labels={RISK_LABELS} />}
    >
      <DailyColumns series={series} keys={BANDS} colors={RISK_COLORS} labels={RISK_LABELS} />
    </ChartFrame>
  );
}

export function SignupsChart({ series }) {
  const labels = { signups: 'New accounts' };
  return (
    <ChartFrame title="New accounts per day" table={<SeriesTable series={series} keys={['signups']} labels={labels} />}>
      <DailyColumns series={series} keys={['signups']} colors={{ signups: SERIES }} labels={labels} height={150} />
    </ChartFrame>
  );
}

/** One horizontal bar split by risk band, with counts and shares beside it. */
export function RiskMix({ risk }) {
  const total = BANDS.reduce((s, k) => s + (risk[k] || 0), 0);
  return (
    <div className="ad-mix">
      <div className="ad-mix-bar" role="img" aria-label={BANDS.map((k) => `${RISK_LABELS[k]} ${risk[k] || 0}`).join(', ')}>
        {total === 0 ? (
          <span className="ad-mix-empty" />
        ) : (
          BANDS.filter((k) => risk[k]).map((k) => (
            <span key={k} style={{ flexGrow: risk[k], background: RISK_COLORS[k] }} title={`${RISK_LABELS[k]}: ${risk[k]}`} />
          ))
        )}
      </div>
      <ul className="ad-mix-legend">
        {BANDS.map((k) => (
          <li key={k}>
            <span className="ad-legend-key" style={{ background: RISK_COLORS[k] }} aria-hidden="true" />
            <span>{RISK_LABELS[k]}</span>
            <strong>{(risk[k] || 0).toLocaleString()}</strong>
            <span className="ad-muted">{total ? `${Math.round(((risk[k] || 0) / total) * 100)}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

