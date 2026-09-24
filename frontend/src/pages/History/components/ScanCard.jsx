import useReplay from './useReplay';
import { TESTS, fmt, reading, status } from '../tests';

// The six results shown in the illustration, two columns of three,
// with short labels so values never get squeezed out.
const SHOWN = [
  ['ldl', 'LDL'],
  ['hdl', 'HDL'],
  ['total_cholesterol', 'Cholesterol'],
  ['bp_mmhg', 'BP'],
  ['rbs_mmol_l', 'Blood sugar'],
  ['troponin_i', 'Troponin-I'],
];

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/** "Latest test results": a scanner beam sweeps the newest lab panel. */
export default function ScanCard({ record }) {
  const [replay, replayOn] = useReplay();
  const all = TESTS.map((t) => ({ test: t, r: reading(t, record.inputs) }));
  const flagged = all.filter(({ r }) => ['high', 'low'].includes(status(r))).length;
  const measured = all.filter(({ r }) => r).length;
  const shown = SHOWN.map(([key, short]) => ({ ...all.find(({ test }) => test.key === key), short }));

  return (
    <article className="pc-h-feature" tabIndex={0} {...replayOn} aria-labelledby="h-scan-title">
      <div className="pc-h-art" aria-hidden="true">
        <div className="pc-h-sheet">
          <div className="pc-h-sheet-head">
            <span className="pc-h-sheet-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" strokeLinejoin="round" />
              </svg>
            </span>
            Lab panel · {dateFmt.format(new Date(record.created_at))}
          </div>
          <div className="pc-h-sheet-rows">
            {shown.map(({ test, r, short }) => (
              <span key={test.key} className={`pc-h-row is-${status(r)}`}>
                <span>{short}</span>
                <b>{fmt(r)}</b>
              </span>
            ))}
            <span className="pc-h-beam" key={replay} />
          </div>
        </div>
        <span className="pc-h-chip" key={`chip-${replay}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m6 12 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Panel reviewed
        </span>
      </div>

      <h3 id="h-scan-title" className="pc-h-feature-title">Latest test results</h3>
      <p className="pc-h-feature-text">
        {measured} results recorded. {flagged === 0 ? 'None are' : `${flagged} ${flagged === 1 ? 'is' : 'are'}`}{' '}
        outside the typical adult range.
      </p>
    </article>
  );
}
