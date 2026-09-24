import useReplay from './useReplay';

// Arc over the top of the hexagon: from 200° round to -20° (220° of sweep).
const CX = 100;
const CY = 104;
const R = 78;
const START = 200;
const SWEEP = 220;

const point = (deg, r = R) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};

const [x0, y0] = point(START);
const [x1, y1] = point(START - SWEEP);
const ARC = `M ${x0} ${y0} A ${R} ${R} 0 1 1 ${x1} ${y1}`;

// A hexagon with rounded corners (thick round-joined stroke in the fill colour).
const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = ((60 * i - 90) * Math.PI) / 180;
  return `${CX + 50 * Math.cos(a)},${CY + 50 * Math.sin(a)}`;
}).join(' ');

const LABELS = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' };

/** "Latest risk estimate": the arc redraws around the hexagon on hover. */
export default function GaugeCard({ record }) {
  const [replay, replayOn] = useReplay();
  const p = record.result.probability;
  const pct = Math.round(p * 100);
  const [tx, ty] = point(START - SWEEP * p, R + 2);
  const [tx2, ty2] = point(START - SWEEP * p, R + 16);

  return (
    <article className="pc-h-feature" tabIndex={0} {...replayOn} aria-labelledby="h-gauge-title">
      <div className="pc-h-art" aria-hidden="true">
        <svg className="pc-h-gauge" viewBox="0 0 200 170" key={replay}>
          <defs>
            <linearGradient id="pc-h-arc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#b19be6" />
              <stop offset="0.6" stopColor="#6833e4" />
            </linearGradient>
            <filter id="pc-h-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#3a1c96" floodOpacity="0.18" />
            </filter>
          </defs>
          <path d={ARC} className="pc-h-arc-track" pathLength="100" />
          <path
            d={ARC}
            className="pc-h-arc"
            pathLength="100"
            style={{ strokeDashoffset: 100 - pct }}
          />
          <line x1={tx} y1={ty} x2={tx2} y2={ty2} className="pc-h-arc-tick" />
          <polygon points={HEX} className="pc-h-hex" filter="url(#pc-h-soft)" />
          <text x={CX} y={CY + 4} className="pc-h-hex-value" textAnchor="middle">
            {pct}%
          </text>
          <text x={CX} y={CY + 22} className="pc-h-hex-label" textAnchor="middle">
            estimate
          </text>
        </svg>
      </div>

      <h3 id="h-gauge-title" className="pc-h-feature-title">Latest risk estimate</h3>
      <p className="pc-h-feature-text">
        {LABELS[record.result.risk_level] ?? record.result.risk_level} on the last assessment. A model estimate,
        not a diagnosis.
      </p>
    </article>
  );
}
