import { useMemo, useState } from 'react';

const W = 440;
const H = 190;
const TOP = 62; // room for the tooltip
const BOTTOM = 170;
const GRID = [70, 110, 150, 185];
const NODES = [2, 7, 12, 17]; // points that get a route-style node

// Catmull-Rom → cubic Bézier, so the line stays smooth through every point.
function smoothPath(pts) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function HeartRateChart({ points = [], caption = 'Resting heart rate, last 24 hours' }) {
  const [active, setActive] = useState(points.length - 1);

  const { coords, path, min, max } = useMemo(() => {
    if (points.length < 2) return { coords: [], path: '', min: 0, max: 0 };
    const values = points.map((p) => p.bpm);
    const lo = Math.min(...values) - 4;
    const hi = Math.max(...values) + 4;
    const c = points.map((p, i) => ({
      x: (i / Math.max(points.length - 1, 1)) * W,
      y: BOTTOM - ((p.bpm - lo) / (hi - lo)) * (BOTTOM - TOP),
    }));
    return { coords: c, path: smoothPath(c), min: Math.min(...values), max: Math.max(...values) };
  }, [points]);

  if (points.length < 2) return null;

  const idx = Math.min(active, points.length - 1);
  const current = coords[idx];
  const point = points[idx];
  const tipLeft = Math.min(Math.max((current.x / W) * 100, 16), 84);

  const pickFromPointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setActive(Math.round(Math.min(Math.max(ratio, 0), 1) * (points.length - 1)));
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') setActive((i) => Math.max(i - 1, 0));
    else if (e.key === 'ArrowRight') setActive((i) => Math.min(i + 1, points.length - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(points.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <figure className="pc-chart pc-enter" style={{ '--d': '440ms' }}>
      <div
        className="pc-chart-area"
        tabIndex={0}
        role="group"
        aria-label={`${caption}. Ranges from ${min} to ${max} bpm. Use left and right arrow keys to inspect values.`}
        onPointerMove={pickFromPointer}
        onPointerDown={pickFromPointer}
        onKeyDown={onKeyDown}
      >
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <linearGradient id="pc-wave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#b19be6" stopOpacity=".35" />
              <stop offset=".35" stopColor="#b19be6" />
              <stop offset=".85" stopColor="#6833e4" />
              <stop offset="1" stopColor="#6833e4" stopOpacity=".5" />
            </linearGradient>
          </defs>
          {GRID.map((y) => (
            <line key={y} x1="0" x2={W} y1={y} y2={y} className="pc-chart-grid" />
          ))}
          <line x1={current.x} x2={current.x} y1={TOP - 14} y2={current.y} className="pc-chart-guide" />
          <path d={path} pathLength="1" className="pc-chart-line" />
          {NODES.filter((n) => n < coords.length - 1).map((n, k) => (
            <circle key={n} cx={coords[n].x} cy={coords[n].y} r="5" className="pc-chart-node" style={{ '--i': k }} />
          ))}
        </svg>

        <span
          className="pc-chart-marker"
          style={{ left: `${(current.x / W) * 100}%`, top: `${(current.y / H) * 100}%` }}
        />
        <span className="pc-chart-tip" style={{ left: `${tipLeft}%`, top: `${((TOP - 14) / H) * 100}%` }}>
          <span className="pc-chart-tip-time">{point.time}</span>
          <strong>{point.bpm} bpm</strong>
        </span>
        <span className="pc-visually-hidden" aria-live="polite">
          {point.time}, {point.bpm} beats per minute
        </span>
      </div>
      <figcaption className="pc-chart-caption">{caption}</figcaption>
    </figure>
  );
}
