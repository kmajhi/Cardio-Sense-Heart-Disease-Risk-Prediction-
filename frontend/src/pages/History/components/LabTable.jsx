import { TESTS, TROPONIN, change, fmt, rangeText, reading, status } from '../tests';

const STATUS_TEXT = { high: 'Above range', low: 'Below range', ok: 'In range', missing: 'Not measured' };

/** Tiny trend line of one test across records (skips gaps and assay changes). */
function Sparkline({ series, flagged }) {
  const values = series.map((r) => r?.value).filter((v) => v !== undefined);
  if (values.length < 2) return <span className="pc-h-spark-empty">—</span>;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 96 + 2},${22 - ((v - lo) / span) * 18}`).join(' ');
  const [lastX, lastY] = pts.split(' ').at(-1).split(',');
  return (
    <svg className={`pc-h-spark${flagged ? ' is-flagged' : ''}`} viewBox="0 0 100 26" aria-hidden="true">
      <polyline points={pts} />
      <circle cx={lastX} cy={lastY} r="2.6" />
    </svg>
  );
}

/** Latest value of every test, its change since the previous record, and trend. */
export default function LabTable({ records }) {
  const latest = records.at(-1);
  const previous = records.at(-2);

  const rows = TESTS.map((test) => {
    const series = records.map((rec) => reading(test, rec.inputs));
    const now = series.at(-1);
    // Sparklines only compare like with like: for troponin, just the latest assay.
    const comparable = test.troponin ? series.map((r) => (r && r.assay === now?.assay ? r : null)) : series;
    return { test, now, series: comparable, delta: change(now, reading(test, previous?.inputs ?? {})), st: status(now) };
  });

  const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <section className="pc-h-card pc-enter" style={{ '--d': '380ms' }} aria-labelledby="h-labs">
      <header className="pc-h-card-head">
        <div>
          <h2 id="h-labs" className="pc-h-card-title">Test results</h2>
          <p className="pc-h-card-sub">Latest panel, {dateFmt.format(new Date(latest.created_at))}, compared with the one before.</p>
        </div>
      </header>

      <div className="pc-h-table-wrap">
        <table className="pc-h-table">
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col" className="is-num">Latest</th>
              <th scope="col" className="is-num">Change</th>
              <th scope="col">Trend</th>
              <th scope="col">Typical range</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ test, now, series, delta, st }, i) => (
              <tr key={test.key} style={{ '--i': i }}>
                <th scope="row">
                  {test.label}
                  {test.troponin && now && <span className="pc-h-assay">{TROPONIN[now.assay].name} assay</span>}
                </th>
                <td className="is-num">
                  <b>{fmt(now)}</b> <span className="pc-h-unit">{now?.unit}</span>
                </td>
                <td className="is-num">
                  {delta.comparable && Math.abs(delta.delta) < 10 ** -now.digits / 2 ? (
                    <span className="pc-h-na">No change</span>
                  ) : delta.comparable ? (
                    <span className={`pc-h-delta ${delta.delta > 0 ? 'is-up' : 'is-down'}`}>
                      {delta.delta > 0 ? '+' : '−'}
                      {Math.abs(delta.delta).toFixed(now.digits)}
                    </span>
                  ) : (
                    <span className="pc-h-na" title={delta.reason === 'Assay changed' ? 'The two assays use different units and are not interchangeable.' : undefined}>
                      {delta.reason}
                    </span>
                  )}
                </td>
                <td>
                  <Sparkline series={series} flagged={st === 'high' || st === 'low'} />
                </td>
                <td className="pc-h-range">
                  {rangeText(now)} {now && <span className="pc-h-unit">{now.unit}</span>}
                </td>
                <td>
                  <span className={`pc-h-status is-${st}`}>{STATUS_TEXT[st]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pc-h-footnote">
        Typical adult reference ranges; your lab's ranges may differ. Changes aren't shown when the troponin assay
        changed between panels, because ng/mL and ng/L results can't be compared.
      </p>
    </section>
  );
}
