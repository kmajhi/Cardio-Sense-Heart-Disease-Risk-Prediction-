import { useEffect, useMemo, useState } from 'react';
import NavBar from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
import { linkProps } from '../../components/link';
import { timeAgo } from '../../notifications/time';
import { useNotifications } from '../../notifications/NotificationsContext';
import { AlertGroups } from '../../notifications/Alerts';
import { recommend } from '../../clinical/recommend';
import { LEVEL_LABEL } from '../../clinical/ranges';
import { RISK } from '../../clinical/risk';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, load sequence
import './Guidance.css';

const SECTION_ICONS = {
  doctor: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10ZM12 10v4M10 12h4',
  diet: 'M5 11h14a7 7 0 0 1-14 0ZM12 4v3M8.5 5.5l1 2M15.5 5.5l-1 2',
  activity: 'M13 4a1.5 1.5 0 1 0 0 .01M9 20l2-6 3 3v3M7 12l3-3 4 1 3 3',
  habits: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
};

function SectionIcon({ id }) {
  return (
    <span className="pc-g-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d={SECTION_ICONS[id]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Suggestions({ section, delay }) {
  return (
    <section className={`pc-g-card pc-g-section is-${section.id} pc-enter`} style={{ '--d': `${delay}ms` }} aria-labelledby={`g-${section.id}`}>
      <header className="pc-g-card-head">
        <SectionIcon id={section.id} />
        <h2 id={`g-${section.id}`}>{section.title}</h2>
      </header>
      <ol className="pc-g-items">
        {section.items.map((item) => (
          <li key={item.id}>
            <p>{item.text}</p>
            {item.because.length > 0 && (
              <p className="pc-g-because">
                <span>Because</span>
                {item.because.map((b) => (
                  <span key={b} className="pc-g-chip">
                    {b}
                  </span>
                ))}
              </p>
            )}
            {item.source && <p className="pc-g-source">Source: {item.source}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Every one of the 21 inputs, how it was judged and against what. */
function ChecksTable({ findings }) {
  return (
    <details className="pc-g-card pc-g-checks pc-enter" style={{ '--d': '420ms' }} id="how-checked">
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
 * suggestions from the latest assessment (src/clinical/recommend.js).
 */
export default function Guidance({ user, LinkComponent = 'a', activePath = '/guidance' }) {
  const ctx = useNotifications();
  const n = ctx?.notification;
  const profile = ctx?.profile ?? null;
  const plan = useMemo(() => recommend(n, profile), [n, profile]);
  const L = LinkComponent;

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const doctor = plan?.sections.find((s) => s.id === 'doctor');
  const rest = plan?.sections.filter((s) => s.id !== 'doctor') ?? [];
  const checked = n ? n.analysis.findings.filter((f) => f.status !== 'missing').length : 0;

  return (
    <div className={`pc-dash pc-guide${ready ? ' is-ready' : ''}`}>
      <NavBar user={user} activePath={activePath} LinkComponent={LinkComponent} />

      <main className="pc-g-main">
        <header className="pc-g-head">
          <h1 className="pc-g-title">
            <span className="pc-wipe pc-thin" style={{ '--d': '120ms' }}>
              Your heart health
            </span>{' '}
            <span className="pc-wipe pc-bold" style={{ '--d': '300ms' }}>
              guidance
            </span>
          </h1>
          <p className="pc-g-sub pc-enter" style={{ '--d': '180ms' }}>
            {n
              ? `Personalised from your latest assessment${n.createdAt ? ` (${timeAgo(n.createdAt)})` : ''}${
                plan.usedProfile ? ' and your profile' : ''}. General guidance, not a diagnosis or treatment plan.`
              : 'Personalised diet, activity and habit suggestions from your prediction results.'}
          </p>
        </header>

        {!n ? (
          <section className="pc-g-card pc-g-empty pc-enter" style={{ '--d': '200ms' }}>
            <h2>No assessment yet</h2>
            <p>Run a prediction first. Your guidance is built from its result and the values you enter.</p>
            <L {...linkProps(L, '/prediction')} className="pc-n-cta">
              Run a prediction <span aria-hidden="true">→</span>
            </L>
          </section>
        ) : (
          <>
            {/* Two separate readings of the same assessment. */}
            <div className="pc-g-summary">
              <section className="pc-g-card pc-enter" style={{ '--d': '160ms' }} aria-labelledby="g-model">
                <p className="pc-g-eyebrow" id="g-model">
                  Model estimate
                </p>
                <p className="pc-g-big">
                  <b>
                    {n.risk.pct}
                    <small>%</small>
                  </b>
                  <span className={`pc-badge is-${n.risk.level}`}>{n.risk.label}</span>
                </p>
                <p className="pc-g-text">{n.risk.body}</p>
                {n.risk.note && <p className="pc-g-text pc-g-muted">{n.risk.note}</p>}
                <p className="pc-g-foot">
                  Bands: low {RISK.low.range}, moderate {RISK.moderate.range}, high {RISK.high.range}. A statistical
                  estimate from one hospital’s data, not validated for clinical use.
                </p>
              </section>

              <section className="pc-g-card pc-enter" style={{ '--d': '220ms' }} aria-labelledby="g-clinical">
                <p className="pc-g-eyebrow" id="g-clinical">
                  Clinical check of your values
                </p>
                <p className="pc-g-big">
                  <b>{n.count}</b>
                  <span>of {checked} checked values outside healthy ranges</span>
                </p>
                {n.groups.length > 0 ? (
                  <ul className="pc-g-areas">
                    {n.groups.map((g) => (
                      <li key={g.id} className={`is-${g.level}`}>
                        {g.title} <b>{LEVEL_LABEL[g.level]}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pc-g-text">Every entered value is inside its reference range.</p>
                )}
                <p className="pc-g-foot">
                  Compared with published guidelines, independently of the model: an abnormal value isn’t proof of
                  heart disease. <a href="#how-checked">How your values were checked</a>
                  {n.analysis.missing.length > 0 && ` · Not measured: ${n.analysis.missing.join(', ')}.`}
                </p>
              </section>
            </div>

            {n.groups.length > 0 && (
              <section className="pc-g-card pc-enter" style={{ '--d': '260ms' }}>
                <AlertGroups groups={n.groups} headingLevel={2} />
              </section>
            )}

            {doctor && <Suggestions section={doctor} delay={300} />}

            <div className="pc-g-grid">
              {rest.map((s, i) => (
                <Suggestions key={s.id} section={s} delay={340 + i * 40} />
              ))}
            </div>

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
