import { useState } from 'react';
import { describe } from '../../../clinical/analyze';
import { LEVEL_LABEL } from '../../../clinical/ranges';
import { linkProps } from '../../../components/link';
import './ResultInsights.css';

const Icon = ({ d, size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const WARN = 'M12 3 3 19h18L12 3ZM12 10v4M12 17h.01';
const INFO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01';
const CHEVRON = 'm9 6 6 6-6 6';

const SHOWN = 3; // alert rows before "Show more"

/** Cautions about the estimate itself, one short line each. Always visible: they
 *  decide how far to trust the number (QA H2/H3, C1). */
function dataNotes(data) {
  const notes = [];
  const missing = data?.missing_fields ?? [];
  if (missing.length) {
    notes.push(`Estimated without ${missing.join(', ')}: filled in from typical values.`);
  }
  for (const o of data?.outside_training ?? []) {
    const edge = o.value > o.max ? `highest seen ${o.max.toLocaleString()}` : `lowest seen ${o.min.toLocaleString()}`;
    notes.push(`${o.name} ${o.value.toLocaleString()} ${o.unit} (${edge}) is beyond the training data.`);
  }
  if (data?.top_factors?.some((f) => f.name === 'Troponin-I')) {
    notes.push('Older model: this estimate used Troponin-I backwards. Run it again for a current one.');
  }
  return notes;
}

export function AlertRow({ group, open, onToggle }) {
  const lead = group.findings[0];
  return (
    <li className={`pc-ri-row is-${group.level}${open ? ' is-open' : ''}`}>
      <button type="button" className="pc-ri-row-btn" aria-expanded={open} onClick={onToggle}>
        <span className="pc-ri-dot" aria-hidden="true" />
        <span className="pc-ri-row-main">
          <span className="pc-ri-row-title">{group.title}</span>
          <span className="pc-ri-row-sub">
            {lead ? describe(lead).split(' · ')[0] : ''}
            {group.findings.length > 1 && ` +${group.findings.length - 1} more`}
          </span>
        </span>
        <span className={`pc-ri-chip is-${group.level}`}>{LEVEL_LABEL[group.level]}</span>
        <span className="pc-ri-chev" aria-hidden="true">
          <Icon d={CHEVRON} size={14} />
        </span>
      </button>
      {open && (
        <div className="pc-ri-row-body">
          <ul>
            {group.findings.map((f) => (
              <li key={f.key}>{describe(f)}</li>
            ))}
          </ul>
          <p>{group.why}</p>
        </div>
      )}
    </li>
  );
}

function Factors({ factors }) {
  const biggest = Math.max(...factors.map((f) => Math.abs(f.contribution)), 0.0001);
  return (
    <ul className="pc-ri-factors">
      {factors.map((f) => {
        const up = f.contribution > 0;
        return (
          <li key={f.name}>
            <span className="pc-ri-factor-name">{f.name}</span>
            <span className="pc-ri-factor-bar" aria-hidden="true">
              <span className={up ? 'is-up' : 'is-down'} style={{ width: `${(Math.abs(f.contribution) / biggest) * 100}%` }} />
            </span>
            <span className={`pc-ri-factor-val ${up ? 'is-up' : 'is-down'}`}>
              {up ? '+' : '−'}
              {Math.abs(f.contribution * 100).toFixed(1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The result card's insights, laid out like a SaaS notification panel: one
 * summary line, an urgent banner only when needed, then tabs (alerts | what
 * moved it) with compact rows that expand for detail, and a single action.
 * Same content as before (clinical/notifications.js), shown in layers.
 */
export default function ResultInsights({ data, notification, LinkComponent = 'a' }) {
  const groups = notification?.groups ?? [];
  const factors = data?.top_factors ?? [];
  const notes = dataNotes(data);
  const [tab, setTab] = useState(groups.length ? 'alerts' : 'factors');
  const [openRow, setOpenRow] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const notesBox = notes.length > 0 && (
    <div className={`pc-ri-notes${data?.low_confidence ? ' is-low' : ''}`}>
      <p className="pc-ri-notes-head">
        <Icon d={INFO} size={14} />
        {data?.low_confidence ? 'Low confidence' : 'About this estimate'}
      </p>
      <ul>
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
  if (!notification) return notesBox || null;

  const { risk, urgent } = notification;
  const shown = showAll ? groups : groups.slice(0, SHOWN);
  const L = LinkComponent;

  return (
    <div className="pc-ri">
      {/* Summary: one line, details on demand */}
      <div className={`pc-ri-summary is-${risk.level}`}>
        <Icon d={risk.level === 'low' ? INFO : WARN} />
        <p>
          <strong>{risk.title}</strong>
          <span>Model estimate, not a diagnosis</span>
        </p>
        <button type="button" className="pc-ri-link" aria-expanded={riskOpen} onClick={() => setRiskOpen((v) => !v)}>
          {riskOpen ? 'Less' : 'Details'}
        </button>
      </div>
      {riskOpen && (
        <p className="pc-ri-detail">
          {risk.body}
          {risk.note && ` ${risk.note}`}
        </p>
      )}

      {urgent.length > 0 && (
        <p className="pc-ri-urgent" role="alert">
          <Icon d={WARN} />
          <span>
            <strong>Urgent:</strong> {urgent.map((g) => g.title).join(' and ')}. Seek medical care promptly.
          </span>
        </p>
      )}

      {notesBox}

      {/* Tabs: one list at a time */}
      <div className="pc-ri-tabs" role="tablist" aria-label="Result details">
        <button type="button" role="tab" aria-selected={tab === 'alerts'} className={tab === 'alerts' ? 'is-on' : ''} onClick={() => setTab('alerts')}>
          Alerts <span className="pc-ri-count">{groups.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'factors'} className={tab === 'factors' ? 'is-on' : ''} onClick={() => setTab('factors')} disabled={!factors.length}>
          What moved it <span className="pc-ri-count">{factors.length}</span>
        </button>
      </div>

      <div role="tabpanel" className="pc-ri-panel">
        {tab === 'alerts' &&
          (groups.length ? (
            <>
              <ul className="pc-ri-rows">
                {shown.map((g) => (
                  <AlertRow key={g.id} group={g} open={openRow === g.id} onToggle={() => setOpenRow(openRow === g.id ? null : g.id)} />
                ))}
              </ul>
              {groups.length > SHOWN && (
                <button type="button" className="pc-ri-more" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `Show ${groups.length - SHOWN} more`}
                </button>
              )}
            </>
          ) : (
            <p className="pc-ri-empty">All values are within their reference ranges.</p>
          ))}
        {tab === 'factors' && (
          <>
            <Factors factors={factors} />
            <p className="pc-ri-caption">Percentage points each input moved this estimate.</p>
          </>
        )}
      </div>

      {notification.needsAttention && (
        <L {...linkProps(L, '/guidance')} className="pc-ri-cta">
          See Personalized Diet & Workout Plan <span aria-hidden="true">→</span>
        </L>
      )}
    </div>
  );
}
