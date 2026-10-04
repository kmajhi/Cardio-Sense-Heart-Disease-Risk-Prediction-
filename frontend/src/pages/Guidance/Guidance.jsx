import { useEffect, useMemo, useState } from 'react';
import NavBar from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
import { linkProps } from '../../components/link';
import { timeAgo } from '../../notifications/time';
import { useNotifications } from '../../notifications/NotificationsContext';
import { recommend } from '../../clinical/recommend';
import { LEVEL_LABEL } from '../../clinical/ranges';
import { RISK } from '../../clinical/risk';
import { AlertRow } from '../Prediction/components/ResultInsights';
import dietImg from '../../assets/guidance-diet.webp';
import activityImg from '../../assets/guidance-activity.webp';
import habitsImg from '../../assets/guidance-habits.webp';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, load sequence
import './Guidance.css';
import './GuidanceDashboard.css';

const ICONS = {
  doctor: 'M6 3v6a5 5 0 0 0 10 0V3M11 14v2a5 5 0 0 0 10 0v-2M21 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  diet: 'M5 11h14a7 7 0 0 1-14 0ZM12 4v3M8.5 5.5l1 2M15.5 5.5l-1 2',
  activity: 'M13 4a1.5 1.5 0 1 0 0 .01M9 20l2-6 3 3v3M7 12l3-3 4 1 3 3',
  habits: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  check: 'M5 12l5 5 9-10',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  warn: 'M12 3 3 19h18L12 3ZM12 10v4M12 17h.01',
};

// The three plan cards: photo, tag line, and how many items show before "Show all".
const PLAN = {
  diet: { img: dietImg, tag: 'Eat for your heart', position: '50% 62%' },
  activity: { img: activityImg, tag: 'Move more, safely', position: '50% 22%' },
  habits: { img: habitsImg, tag: 'Small daily routines', position: '50% 35%' },
};
const PREVIEW = 3;

function Icon({ name, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={ICONS[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** One suggestion: the advice, then what triggered it and its guideline, quietly. */
function Item({ item, index }) {
  return (
    <li className="pc-gd-item">
      <span className="pc-gd-item-n">{index + 1}</span>
      <div>
        <p className="pc-gd-item-text">{item.text}</p>
        {(item.because.length > 0 || item.source) && (
          <p className="pc-gd-item-meta">
            {item.because.map((b) => (
              <span key={b} className="pc-gd-chip">
                {b.split(' · ')[0]}
              </span>
            ))}
            {item.source && <span className="pc-gd-source">{item.source}</span>}
          </p>
        )}
      </div>
    </li>
  );
}

/** Diet, activity or habits: a dashboard card with the section's photo as its header. */
function PlanCard({ section, delay }) {
  const [all, setAll] = useState(false);
  const look = PLAN[section.id];
  const items = all ? section.items : section.items.slice(0, PREVIEW);
  return (
    <section className={`pc-gd-plan is-${section.id} pc-enter`} style={{ '--d': `${delay}ms` }} aria-labelledby={`g-${section.id}`}>
      <div className="pc-gd-plan-media">
        <img src={look.img} alt="" style={{ objectPosition: look.position }} loading="lazy" />
        <div className="pc-gd-plan-overlay">
          <span className="pc-gd-plan-icon">
            <Icon name={section.id} />
          </span>
          <div>
            <p className="pc-gd-plan-tag">{look.tag}</p>
            <h2 id={`g-${section.id}`}>{section.title}</h2>
          </div>
          <span className="pc-gd-plan-count">{section.items.length}</span>
        </div>
      </div>
      <ol className="pc-gd-items">
        {items.map((item, i) => (
          <Item key={item.id} item={item} index={i} />
        ))}
      </ol>
      {section.items.length > PREVIEW && (
        <button type="button" className="pc-gd-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${section.items.length}`}
        </button>
      )}
    </section>
  );
}

/** Every one of the 21 inputs, how it was judged and against what. */
function ChecksTable({ findings }) {
  return (
    <details className="pc-g-card pc-g-checks pc-gd-checks pc-enter" style={{ '--d': '420ms' }} id="how-checked">
      <summary>
        <h2>How your values were checked</h2>
        <span>Every input, its reference range and the guideline behind it</span>
      </summary>
      <div className="pc-g-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Input</th>
              <th scope="col">Value</th>
              <th scope="col">Healthy range</th>
              <th scope="col">Result</th>
              <th scope="col">Reference</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f) => (
              <tr key={f.key}>
                <th scope="row">{f.label}</th>
                <td>{f.status === 'missing' ? '—' : `${f.display}${f.unit ? ` ${f.unit}` : ''}`}</td>
                <td>{f.kind === 'history' ? 'Not reported' : f.range ? `${f.range}${f.unit ? ` ${f.unit}` : ''}` : '—'}</td>
                <td>
                  {f.status === 'missing' ? (
                    <span className="pc-g-status">Not measured</span>
                  ) : (
                    <span className={`pc-g-status is-${f.level ?? 'uncertain'}`}>
                      {f.level ? LEVEL_LABEL[f.level] : 'Unclear'}
                      {f.level !== 'normal' && f.band ? ` · ${f.band}` : ''}
                    </span>
                  )}
                </td>
                <td className="pc-g-ref">{f.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pc-g-table-note">
        Age and sex set which ranges apply but aren’t judged themselves. Height and weight are judged together as BMI,
        and the maximum heart rate is a formula of age and sex, so it isn’t judged either.
      </p>
    </details>
  );
}

/**
 * Cardio Sense — Guidance page: personalised diet, activity and habit
 * suggestions from the latest assessment (src/clinical/recommend.js), laid out
 * as a dashboard: KPI cards, the doctor card, three photo plan cards, then the
 * areas to watch and the full table of checks.
 */
export default function Guidance({ user, LinkComponent = 'a', activePath = '/guidance' }) {
  const ctx = useNotifications();
  const n = ctx?.notification;
  const profile = ctx?.profile ?? null;
  const plan = useMemo(() => recommend(n, profile), [n, profile]);
  const L = LinkComponent;
  const [openRow, setOpenRow] = useState(null);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const doctor = plan?.sections.find((s) => s.id === 'doctor');
  const rest = plan?.sections.filter((s) => s.id !== 'doctor') ?? [];
  const checked = n ? n.analysis.findings.filter((f) => f.status !== 'missing').length : 0;
  const total = plan ? plan.sections.reduce((sum, s) => sum + s.items.length, 0) : 0;
  const pct = n ? Number(n.risk.pct.replace(/[<>]/g, '')) : 0;

  return (
    <div className={`pc-dash pc-guide${ready ? ' is-ready' : ''}`}>
      <NavBar user={user} activePath={activePath} LinkComponent={LinkComponent} />

      <main className="pc-g-main pc-gd">
        <header className="pc-gd-head">
          <div>
            <h1 className="pc-g-title">
              <span className="pc-wipe pc-thin" style={{ '--d': '120ms' }}>
                Your heart health
              </span>{' '}
              <span className="pc-wipe pc-bold" style={{ '--d': '300ms' }}>
                guidance
              </span>
            </h1>
            <p className="pc-g-sub pc-enter" style={{ '--d': '180ms' }}>
              General guidance from published guidelines, not a diagnosis or treatment plan.
            </p>
          </div>
          {n && (
            <ul className="pc-gd-meta pc-enter" style={{ '--d': '220ms' }}>
              {n.createdAt && <li>Latest assessment · {timeAgo(n.createdAt)}</li>}
              <li>{plan.usedProfile ? 'Personalised with your profile' : 'Add a profile for more personal tips'}</li>
            </ul>
          )}
        </header>

        {!n ? (
          <section className="pc-gd-card pc-gd-empty pc-enter" style={{ '--d': '200ms' }}>
            <span className="pc-gd-kpi-icon">
              <Icon name="pulse" />
            </span>
            <h2>No assessment yet</h2>
            <p>Run a prediction first. Your guidance is built from its result and the values you enter.</p>
            <L {...linkProps(L, '/prediction')} className="pc-gd-btn">
              Run a prediction <span aria-hidden="true">→</span>
            </L>
          </section>
        ) : (
          <>
            {/* KPI row: the two independent readings, and the plan they produce. */}
            <div className="pc-gd-kpis">
              <section className="pc-gd-card pc-gd-kpi pc-enter" style={{ '--d': '160ms' }} aria-labelledby="g-model">
                <header>
                  <span className="pc-gd-kpi-icon">
                    <Icon name="pulse" />
                  </span>
                  <p id="g-model">Model estimate</p>
                  <span className={`pc-badge is-${n.risk.level}`}>{n.risk.label}</span>
                </header>
                <p className="pc-gd-kpi-value">
                  {n.risk.pct}
                  <small>%</small>
                </p>
                <span className="pc-gd-scale" aria-hidden="true">
                  <i style={{ left: `${Math.min(98, Math.max(2, pct))}%` }} />
                </span>
                <p className="pc-gd-kpi-foot">
                  Low {RISK.low.range} · moderate {RISK.moderate.range} · high {RISK.high.range}
                </p>
              </section>

              <section className="pc-gd-card pc-gd-kpi pc-enter" style={{ '--d': '200ms' }} aria-labelledby="g-clinical">
                <header>
                  <span className="pc-gd-kpi-icon">
                    <Icon name="check" />
                  </span>
                  <p id="g-clinical">Values outside range</p>
                </header>
                <p className="pc-gd-kpi-value">
                  {n.count}
                  <small> / {checked} checked</small>
                </p>
                <span className="pc-gd-dots" aria-hidden="true">
                  {n.analysis.findings
                    .filter((f) => f.status !== 'missing')
                    .map((f) => (
                      <i key={f.key} className={`is-${f.status === 'flagged' ? f.level : 'normal'}`} />
                    ))}
                </span>
                <p className="pc-gd-kpi-foot">
                  {n.analysis.missing.length > 0 ? `Not measured: ${n.analysis.missing.length}` : 'Every value was measured'} ·{' '}
                  <a href="#how-checked">See all checks</a>
                </p>
              </section>

              <section className="pc-gd-card pc-gd-kpi pc-enter" style={{ '--d': '240ms' }} aria-labelledby="g-plan">
                <header>
                  <span className="pc-gd-kpi-icon">
                    <Icon name="list" />
                  </span>
                  <p id="g-plan">Your plan</p>
                </header>
                <p className="pc-gd-kpi-value">
                  {total}
                  <small> suggestions</small>
                </p>
                <ul className="pc-gd-split">
                  {plan.sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#g-${s.id}`}>
                        <Icon name={s.id} size={14} />
                        {s.items.length}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="pc-gd-kpi-foot">Doctor · diet · activity · habits</p>
              </section>
            </div>

            {doctor && (
              <section
                className={`pc-gd-card pc-gd-doctor${n.urgent.length ? ' is-urgent' : ''} pc-enter`}
                style={{ '--d': '280ms' }}
                aria-labelledby="g-doctor"
              >
                <header className="pc-gd-card-head">
                  <span className="pc-gd-kpi-icon">
                    <Icon name={n.urgent.length ? 'warn' : 'doctor'} />
                  </span>
                  <div>
                    <h2 id="g-doctor">{doctor.title}</h2>
                    <p>{n.urgent.length ? 'Some values need prompt medical attention. Start here.' : 'When a value is worth a conversation with your doctor.'}</p>
                  </div>
                </header>
                <ol className="pc-gd-items is-columns">
                  {doctor.items.map((item, i) => (
                    <Item key={item.id} item={item} index={i} />
                  ))}
                </ol>
              </section>
            )}

            <div className="pc-gd-plans">
              {rest.map((s, i) => (
                <PlanCard key={s.id} section={s} delay={320 + i * 50} />
              ))}
            </div>

            {n.groups.length > 0 && (
              <section className="pc-gd-card pc-gd-watch pc-enter" style={{ '--d': '380ms' }} aria-labelledby="g-watch">
                <header className="pc-gd-card-head">
                  <div>
                    <h2 id="g-watch">Areas to watch</h2>
                    <p>Checked against published reference ranges, separately from the model. Select one for details.</p>
                  </div>
                </header>
                <ul className="pc-ri-rows">
                  {n.groups.map((g) => (
                    <AlertRow key={g.id} group={g} open={openRow === g.id} onToggle={() => setOpenRow(openRow === g.id ? null : g.id)} />
                  ))}
                </ul>
              </section>
            )}

            <ChecksTable findings={n.analysis.findings} />

            <p className="pc-g-disclaimer pc-enter" style={{ '--d': '460ms' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 3 3 19h18L12 3Z" strokeLinejoin="round" />
                <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
              </svg>
              Research prototype. These suggestions are general lifestyle guidance based on published guidelines. They
              are not a diagnosis and don’t replace advice from a qualified healthcare professional. Don’t start, stop
              or change any medicine because of them.
            </p>
          </>
        )}
      </main>
      <SiteFooter LinkComponent={LinkComponent} activePath={activePath} />
    </div>
  );
}
