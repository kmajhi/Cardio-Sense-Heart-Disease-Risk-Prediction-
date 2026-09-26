import { useState } from 'react';
import HeartHero from '../../Dashboard/components/HeartHero';
import { LEVELS, panel, pct } from '../board';
import { fmt } from '../tests';

const TABS = ['Overview', 'Lipids', 'Vitals'];

const pick = (rows, key, label) => {
  const row = rows.find((r) => r.test.key === key);
  return { label, value: fmt(row.r), unit: row.r?.unit ?? '', st: row.st };
};

function spotsFor(tab, records) {
  const latest = records.at(-1);
  const rows = panel(latest);
  if (tab === 'Lipids') {
    return [pick(rows, 'ldl', 'LDL'), pick(rows, 'hdl', 'HDL'), pick(rows, 'triglycerides', 'Triglycerides')];
  }
  if (tab === 'Vitals') {
    return [pick(rows, 'bp_mmhg', 'Blood pressure'), pick(rows, 'rbs_mmol_l', 'Blood sugar'), pick(rows, 'troponin_i', 'Troponin-I')];
  }
  const flagged = rows.filter((r) => r.st === 'high' || r.st === 'low').length;
  return [
    { label: 'Risk estimate', value: `${pct(latest)}%`, unit: LEVELS[latest.result.risk_level]?.label ?? '', st: 'info' },
    { label: 'Outside range', value: String(flagged), unit: flagged === 1 ? 'test' : 'tests', st: flagged ? 'high' : 'ok' },
    { label: 'Assessments', value: String(records.length), unit: 'on record', st: 'info' },
  ];
}

const DOT_TEXT = { high: 'above typical range', low: 'below typical range', ok: 'in typical range' };

/**
 * The glowing heart with tab pills and three glass callouts pinned to it,
 * like the reference's anatomy hotspots. Switching tabs pops new callouts in.
 *
 * The callouts are siblings of <HeartHero />, never wrappers, and this
 * column adds no transform/filter/opacity/z-index: the heart video's screen
 * blend needs that (see HeartHero.jsx).
 */
export default function HeartInsights({ records }) {
  const [tab, setTab] = useState(TABS[0]);
  // The first callouts wait for the heart to open; later tab switches pop in at once.
  const [switched, setSwitched] = useState(false);
  const spots = spotsFor(tab, records);

  return (
    <section className="pc-h-heart" aria-label="Latest values on the heart">
      <div className="pc-h-tabs pc-enter" style={{ '--d': '200ms' }} role="group" aria-label="Show values">
        {TABS.map((t) => (
          <button key={t} type="button" className="pc-h-tab" aria-pressed={tab === t} onClick={() => {
              setTab(t);
              setSwitched(true);
            }}>
            {t}
          </button>
        ))}
      </div>

      <div className="pc-h-heart-stage">
        <HeartHero showCta={false} />
        <ul
          className="pc-h-spots"
          style={{ '--base': switched ? '0s' : '1.3s' }}
          aria-live="polite"
          aria-label={`${tab} values`}
        >
          {spots.map((s, i) => (
            <li key={`${tab}-${s.label}`} className={`pc-h-spot pc-h-spot--${i + 1}`} style={{ '--i': i }}>
              <span className="pc-h-spot-ring" aria-hidden="true" />
              <span className="pc-h-spot-card">
                <span className="pc-h-spot-label">
                  {s.st !== 'info' && <span className={`pc-h-spot-dot is-${s.st}`} aria-hidden="true" />}
                  {s.label}
                </span>
                <strong>
                  {s.value} <small>{s.unit}</small>
                </strong>
                {DOT_TEXT[s.st] && <span className="pc-visually-hidden">, {DOT_TEXT[s.st]}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
