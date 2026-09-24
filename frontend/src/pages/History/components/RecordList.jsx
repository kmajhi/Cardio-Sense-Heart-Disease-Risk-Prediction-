import { useState } from 'react';
import { TESTS, fmt, reading, status } from '../tests';

const LEVELS = {
  low: { label: 'Low risk', className: 'is-low' },
  moderate: { label: 'Moderate risk', className: 'is-moderate' },
  high: { label: 'High risk', className: 'is-high' },
};

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

const GROUPS = [...new Set(TESTS.map((t) => t.group))];

function MiniRing({ p }) {
  const c = 2 * Math.PI * 16;
  return (
    <svg className="pc-h-ring" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" className="pc-h-ring-track" />
      <circle cx="20" cy="20" r="16" className="pc-h-ring-arc" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
    </svg>
  );
}

function RecordDetail({ record }) {
  const biggest = Math.max(...record.result.top_factors.map((f) => Math.abs(f.contribution)), 0.0001);
  return (
    <div className="pc-h-detail">
      {/* Same scanner sweep as the overview card, run once as the panel opens. */}
      <span className="pc-h-beam pc-h-beam--detail" aria-hidden="true" />
      <div className="pc-h-detail-results">
        {GROUPS.map((group) => (
          <div key={group} className="pc-h-group">
            <h4>{group}</h4>
            <dl>
              {TESTS.filter((t) => t.group === group).map((t) => {
                const r = reading(t, record.inputs);
                const st = status(r);
                return (
                  <div key={t.key} className={`is-${st}`}>
                    <dt>{t.label}</dt>
                    <dd>
                      {fmt(r)} <span>{r?.unit}</span>
                      {(st === 'high' || st === 'low') && <span className="pc-visually-hidden"> ({st === 'high' ? 'above' : 'below'} typical range)</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      <div className="pc-h-detail-factors">
        <h4>What moved this estimate</h4>
        <ul>
          {record.result.top_factors.map((f) => {
            const up = f.contribution > 0;
            return (
              <li key={f.name}>
                <span className="pc-h-factor-name">{f.name}</span>
                <span className="pc-h-factor-bar" aria-hidden="true">
                  <span className={up ? 'is-up' : 'is-down'} style={{ width: `${(Math.abs(f.contribution) / biggest) * 100}%` }} />
                </span>
                <span className={`pc-h-factor-val ${up ? 'is-up' : 'is-down'}`}>
                  {up ? 'raised' : 'lowered'} {Math.abs(f.contribution * 100).toFixed(1)} pts
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Every past assessment, newest first; each opens to its full test results. */
export default function RecordList({ records }) {
  const newestFirst = [...records].reverse();
  const [open, setOpen] = useState(newestFirst[0]?.id ?? null);

  return (
    <section className="pc-h-card pc-enter" style={{ '--d': '460ms' }} aria-labelledby="h-records">
      <header className="pc-h-card-head">
        <div>
          <h2 id="h-records" className="pc-h-card-title">Assessment records</h2>
          <p className="pc-h-card-sub">Each prediction with the test results it was based on.</p>
        </div>
      </header>

      <ol className="pc-h-records">
        {newestFirst.map((rec, i) => {
          const level = LEVELS[rec.result.risk_level];
          const date = new Date(rec.created_at);
          const isOpen = open === rec.id;
          const flagged = TESTS.filter((t) => ['high', 'low'].includes(status(reading(t, rec.inputs)))).length;
          return (
            <li key={rec.id} className={`pc-h-record${isOpen ? ' is-open' : ''}`} style={{ '--i': i }}>
              <button
                type="button"
                className="pc-h-record-row"
                aria-expanded={isOpen}
                aria-controls={`h-rec-${rec.id}`}
                onClick={() => setOpen(isOpen ? null : rec.id)}
              >
                <MiniRing p={rec.result.probability} />
                <span className="pc-h-record-main">
                  <span className="pc-h-record-date">
                    {dayFmt.format(date)} <span>{timeFmt.format(date)}</span>
                  </span>
                  <span className="pc-h-record-meta">
                    {rec.id} · {flagged === 0 ? 'all results in range' : `${flagged} outside typical range`}
                  </span>
                </span>
                <span className="pc-h-record-pct">
                  {Math.round(rec.result.probability * 100)}
                  <span>%</span>
                </span>
                <span className={`pc-badge ${level?.className ?? ''}`}>{level?.label ?? rec.result.risk_level}</span>
                <span className="pc-h-chevron" aria-hidden="true" />
              </button>
              <div id={`h-rec-${rec.id}`} className="pc-h-record-body" role="region" aria-label={`Results for ${dayFmt.format(date)}`}>
                <div className="pc-h-record-inner">{isOpen && <RecordDetail record={rec} />}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
