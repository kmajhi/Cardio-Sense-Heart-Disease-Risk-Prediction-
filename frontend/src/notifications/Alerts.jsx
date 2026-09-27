import { describe } from '../clinical/analyze';
import { LEVEL_LABEL } from '../clinical/ranges';
import { linkProps } from '../components/link';
import RelativeTime from './RelativeTime';
import './notifications.css';

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const WARN = 'M12 3 3 19h18L12 3ZM12 10v4M12 17h.01';
const INFO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01';

/** The model's overall estimate, worded for its band. `time`: when it was received (ISO). */
export function RiskNotice({ risk, live = false, time }) {
  return (
    <div className={`pc-n-risk is-${risk.level}`} role={live && risk.level === 'high' ? 'alert' : undefined}>
      <Icon d={risk.level === 'low' ? INFO : WARN} />
      <div>
        <p className="pc-n-risk-title">
          <span className="pc-n-risk-name">
            {risk.title} <span>· model estimate</span>
          </span>
          <RelativeTime iso={time} />
        </p>
        <p>{risk.body}</p>
        {risk.note && <p className="pc-n-note">{risk.note}</p>}
      </div>
    </div>
  );
}

/**
 * Values outside healthy ranges, one entry per topic (never one per value), most
 * serious first. `limit` caps how many topics show; the rest are counted.
 */
export function AlertGroups({ groups, limit = Infinity, headingLevel = 3, time }) {
  if (!groups.length) return null;
  const H = `h${headingLevel}`;
  const shown = groups.slice(0, limit);
  const hidden = groups.length - shown.length;
  const urgent = groups.filter((g) => g.level === 'urgent');

  return (
    <section className="pc-n-groups" aria-label="Values outside healthy ranges">
      <H className="pc-n-heading">Values outside healthy ranges</H>
      <p className="pc-n-sub">Checked against published reference ranges, separately from the model’s estimate.</p>
      {urgent.length > 0 && (
        <p className="pc-n-urgent" role="alert">
          <Icon d={WARN} />
          {urgent.map((g) => g.title).join(' and ')} {urgent.length === 1 ? 'needs' : 'need'} prompt medical attention.
        </p>
      )}
      <ul>
        {shown.map((g) => (
          <li key={g.id} className={`pc-n-group is-${g.level}`}>
            <div className="pc-n-group-top">
              <strong>{g.title}</strong>
              <span className={`pc-n-level is-${g.level}`}>{LEVEL_LABEL[g.level]}</span>
              <RelativeTime iso={time} />
            </div>
            <ul className="pc-n-findings">
              {g.findings.map((f) => (
                <li key={f.key}>{describe(f)}</li>
              ))}
            </ul>
            <details className="pc-n-why">
              <summary>Why it matters</summary>
              <p>{g.why}</p>
            </details>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="pc-n-more">
          +{hidden} more {hidden === 1 ? 'area' : 'areas'} in your guidance
        </p>
      )}
    </section>
  );
}

export function GuidanceLink({ LinkComponent = 'a', onClick, children = 'See personalized diet & workout' }) {
  const L = LinkComponent;
  return (
    <L {...linkProps(L, '/guidance')} className="pc-n-cta" onClick={onClick}>
      {children}
      <span aria-hidden="true">→</span>
    </L>
  );
}
