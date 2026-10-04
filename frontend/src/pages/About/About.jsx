import { useEffect, useState } from 'react';
import NavBar from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
import { linkProps } from '../../components/link';
import { useAuth } from '../../auth/AuthContext';
import CountUp from './components/CountUp';
import HeroStage from './components/HeroStage';
import ProductTour from './components/ProductTour';
import useInView from './components/useInView';
import {
  AUDIENCES,
  DISCLAIMER,
  FACTS,
  FAQ,
  GET_NUMBERS,
  HERO,
  INPUTS,
  INPUT_GROUPS,
  JOURNEY,
  LIMITATIONS,
  METHOD,
  METRICS,
  MISSION,
  PIPELINE,
  PLATFORM,
  PRINCIPLES,
  STACK,
  TRUST,
} from './content';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, hero orb, page wipe
import './About.css';
import './about-system.css'; // the minimal card system for everything below the hero

const PATHS = {
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  shield: 'M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3ZM9 12l2 2 4-4',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  grid: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  leaf: 'M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19l7-7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  console: 'M3 5h18v14H3zM7 9l3 3-3 3M13 15h4',
  stethoscope: 'M6 3v6a5 5 0 0 0 10 0V3M11 14v2a5 5 0 0 0 10 0v-2M21 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  heart: 'M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11Z',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5ZM4 19a2 2 0 0 1 2-2h14',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  key: 'M14 10a4 4 0 1 0-3.9 4L4 20v-3h3v-3h3l.1-.1A4 4 0 0 0 14 10ZM16 8h.01',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  check: 'M5 12l5 5 9-10',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  warn: 'M12 3 3 19h18L12 3ZM12 10v4M12 17h.01',
  measure: 'M4 16a8 8 0 1 1 16 0M12 16l4-5',
  yesno: 'M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8ZM17 12h.01',
  derived: 'M5 19 19 5M7 5h4M9 3v4M13 17h4',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 14h9',
  marker: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3',
};

function Icon({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** A section heading that rises in when scrolled to. */
function SectionHead({ eyebrow, title, text, center = false, id, light = false }) {
  const [ref, inView] = useInView({ threshold: 0.1 });
  return (
    <header ref={ref} className={`pc-a-head${center ? ' is-center' : ''}${light ? ' is-light' : ''}${inView ? ' is-in' : ''}`}>
      <p className="pc-a-eyebrow">{eyebrow}</p>
      <h2 id={id} className="pc-a-h2">
        {title}
      </h2>
      {text && <p className="pc-a-text">{text}</p>}
    </header>
  );
}

/** Children fade up once in view. Low threshold, so fast scrolling never leaves a blank screen. */
function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const [ref, inView] = useInView({ threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  return (
    <Tag ref={ref} className={`pc-reveal${inView ? ' is-in' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// Tiny, decorative previews inside the platform cards.
function MiniVisual({ kind }) {
  switch (kind) {
    case 'prediction':
      return (
        <div className="pc-mini pc-mini-pred" aria-hidden="true">
          <div className="pc-mini-form">
            {[
              ['Age', '52 yrs', 43],
              ['Systolic BP', '138 mmHg', 58],
              ['LDL', '148 mg/dL', 66],
              ['HDL', '38 mg/dL', 30],
            ].map(([label, value, w]) => (
              <span key={label} className="pc-mini-row">
                <span>
                  {label}
                  <b>{value}</b>
                </span>
                <span className="pc-mini-slider">
                  <span style={{ width: `${w}%` }} />
                </span>
              </span>
            ))}
          </div>
          <div className="pc-mini-out">
            <span className="pc-mini-pct">
              46<i>%</i>
            </span>
            <span className="pc-mini-result">Moderate risk</span>
            {[
              ['LDL', 98],
              ['Systolic BP', 61],
              ['HDL', 44],
            ].map(([name, w]) => (
              <span key={name} className="pc-mini-factor">
                <span>{name}</span>
                <span className="pc-mini-fbar">
                  <span style={{ width: `${w}%` }} />
                </span>
              </span>
            ))}
          </div>
        </div>
      );
    case 'dashboard':
      return (
        <svg className="pc-mini pc-mini-line" viewBox="0 0 160 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 48 C20 44 30 30 50 34 S80 20 100 24 S135 10 160 14 L160 60 L0 60Z" className="fill" />
          <path d="M0 48 C20 44 30 30 50 34 S80 20 100 24 S135 10 160 14" className="line" />
        </svg>
      );
    case 'history':
      return (
        <div className="pc-mini pc-mini-bars" aria-hidden="true">
          {[38, 52, 46, 64, 58, 40, 30].map((h, i) => (
            <span key={i} style={{ height: `${h}%`, '--i': i }} />
          ))}
        </div>
      );
    case 'guidance':
      return (
        <ul className="pc-mini pc-mini-list" aria-hidden="true">
          <li>When to talk to a doctor</li>
          <li>Diet</li>
          <li>Physical activity & workout</li>
          <li>Daily habits</li>
        </ul>
      );
    case 'profile':
      return (
        <div className="pc-mini pc-mini-profile" aria-hidden="true">
          <span className="pc-mini-avatar">MS</span>
          <span className="pc-mini-lines">
            <i />
            <i />
          </span>
          <span className="pc-mini-pdf">PDF</span>
        </div>
      );
    case 'alerts':
      return (
        <div className="pc-mini pc-mini-alerts" aria-hidden="true">
          <span className="is-warn">LDL borderline high</span>
          <span className="is-ok">New estimate: 18%</span>
        </div>
      );
    case 'admin':
      return (
        <div className="pc-mini pc-mini-admin" aria-hidden="true">
          {['Users', 'Assessments', 'Security', 'Audit log'].map((l, i) => (
            <span key={l} className="pc-mini-kpi">
              <i>{l}</i>
              <span className="pc-mini-spark" style={{ '--w': `${[62, 84, 38, 70][i]}%` }} />
            </span>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function fmtDay(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Cardio Sense — About page. Hero → mission → product tour → platform →
 * audiences → inputs → the science → trust → journey → FAQ → call to action.
 * Copy lives in content.js and must stay true of the app as built.
 */
export default function About({ user = { name: 'Demo User' }, hasNotifications = false, LinkComponent = 'a', activePath = '/about' }) {
  const L = LinkComponent;
  const { user: account } = useAuth();
  const isStaff = Boolean(account?.is_staff);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [group, setGroup] = useState('All');

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const [factsRef, factsIn] = useInView({ threshold: 0.3 });
  const [tourRef, tourIn] = useInView({ threshold: 0.05 });
  const [metricsRef, metricsIn] = useInView({ threshold: 0.3 });

  const shownInputs = INPUTS.filter((i) => group === 'All' || i.group === group);

  return (
    <div className={`pc-dash pc-about${ready ? ' is-ready' : ''}${scrolled ? ' is-scrolled' : ''}`}>
      <NavBar user={user} hasNotifications={hasNotifications} activePath={activePath} LinkComponent={LinkComponent} />

      <main className="pc-a-main">
        {/* ---------- Hero ---------- */}
        <section className="pc-a-hero" aria-labelledby="a-title">
          {/* The Dashboard's fog, rolling in along the bottom of the glass panel. */}
          <div className="pc-fog" aria-hidden="true">
            <span style={{ '--d': '100ms' }} />
            <span style={{ '--d': '300ms' }} />
            <span style={{ '--d': '500ms' }} />
          </div>
          <div className="pc-a-hero-copy">
            <p className="pc-a-badge pc-enter" style={{ '--d': '60ms' }}>
              <span className="pc-a-badge-dot" aria-hidden="true" />
              {HERO.badge}
            </p>
            <h1 id="a-title" className="pc-a-h1">
              {HERO.lines.map((line, i) => (
                <span key={line.text} className={`pc-wipe pc-${line.weight}`} style={{ '--d': `${140 + i * 160}ms` }}>
                  {line.accent ? (
                    <>
                      <em className="pc-a-accent">{line.accent}</em>
                      {line.text.slice(line.accent.length)}
                    </>
                  ) : (
                    line.text
                  )}
                </span>
              ))}
            </h1>
            <p className="pc-a-lead pc-enter" style={{ '--d': '520ms' }}>
              {HERO.lead}
            </p>
            <ul className="pc-a-hero-points pc-enter" style={{ '--d': '580ms' }}>
              {HERO.points.map((p) => (
                <li key={p.text}>
                  <Icon name={p.icon} />
                  {p.text}
                </li>
              ))}
            </ul>
            <div className="pc-a-hero-actions pc-enter" style={{ '--d': '640ms' }}>
              <L {...linkProps(L, '/prediction')} className="pc-a-btn">
                Run a prediction <span className="pc-hero-cta-arrow" aria-hidden="true">→</span>
              </L>
              <a href="#a-how" className="pc-a-link">
                See how it works ↓
              </a>
            </div>
          </div>
          <div className="pc-a-hero-art pc-enter" style={{ '--d': '200ms' }}>
            <HeroStage />
          </div>
        </section>

        <ul ref={factsRef} className={`pc-a-facts${factsIn ? ' is-in' : ''}`} aria-label="Cardio Sense in numbers">
          {FACTS.map((f, i) => (
            <li key={f.label} style={{ '--i': i }}>
              <b>
                <CountUp value={f.value} start={factsIn} duration={1100} prefix={f.prefix ?? ''} suffix={f.suffix ?? ''} />
              </b>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>

        <nav className="pc-a-jump" aria-label="On this page">
          {[
            ['a-mission', 'Mission'],
            ['a-how', 'How it works'],
            ['a-platform', 'Platform'],
            ['a-tests', 'Tests you need'],
            ['a-inputs', 'Inputs'],
            ['a-model', 'The science'],
            ['a-trust', 'Privacy'],
            ['a-journey', 'Journey'],
            ['a-faq', 'FAQ'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

        {/* ---------- Mission ---------- */}
        <section className="pc-a-section pc-a-mission" aria-labelledby="a-mission">
          <div className="pc-a-mission-top">
            <SectionHead id="a-mission" eyebrow="Our mission" title={MISSION.statement} />
            <Reveal as="p" className="pc-a-mission-text">
              {MISSION.text}
            </Reveal>
          </div>
          <Reveal as="ul" className="pc-a-contrasts">
            {MISSION.contrasts.map((c, i) => (
              <li key={c.problem} style={{ '--i': i }}>
                <span className="pc-a-problem">
                  <Icon name="warn" size={16} /> {c.problem}
                </span>
                <span className="pc-a-answer">
                  <Icon name="check" size={16} /> {c.answer}
                </span>
              </li>
            ))}
          </Reveal>
          <Reveal as="ul" className="pc-a-principles">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} style={{ '--i': i }}>
                <span className="pc-a-icon">
                  <Icon name={p.icon} />
                </span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </Reveal>
        </section>

        {/* ---------- How it works ---------- */}
        <section ref={tourRef} className="pc-a-section" aria-labelledby="a-how">
          <SectionHead
            id="a-how"
            center
            eyebrow="How it works"
            title="From routine values to an explained result"
            text="Four steps, about a minute."
          />
          <ProductTour inView={tourIn} />
        </section>

        {/* ---------- Platform ---------- */}
        <section className="pc-a-section" aria-labelledby="a-platform">
          <SectionHead
            id="a-platform"
            eyebrow="The platform"
            title="Everything in one place"
            text="More than a calculator."
          />
          <Reveal as="ul" className="pc-bento">
            {PLATFORM.map((p, i) => {
              const locked = p.staff && !isStaff;
              const body = (
                <>
                  <span className="pc-bento-head">
                    <span className="pc-a-icon">
                      <Icon name={p.icon} />
                    </span>
                    {p.staff && <span className="pc-bento-tag">For staff</span>}
                  </span>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                  <MiniVisual kind={p.key} />
                  {!locked && (
                    <span className="pc-bento-go">
                      {p.cta ?? `Open ${p.title.split(' ')[0]}`} <Icon name="arrow" size={15} />
                    </span>
                  )}
                </>
              );
              return (
                <li key={p.key} className={`pc-bento-card is-${p.key}`} style={{ '--i': i }}>
                  {locked ? (
                    <div className="pc-bento-inner">{body}</div>
                  ) : (
                    <L {...linkProps(L, p.to)} className="pc-bento-inner">
                      {body}
                    </L>
                  )}
                </li>
              );
            })}
          </Reveal>
        </section>

        {/* ---------- Audiences ---------- */}
        <section className="pc-a-section" aria-labelledby="a-who">
          <SectionHead id="a-who" center eyebrow="Who it’s for" title="Built for the people around a result" />
          <Reveal as="ul" className="pc-a-audiences">
            {AUDIENCES.map((a, i) => (
              <li key={a.who} style={{ '--i': i }}>
                <span className="pc-a-icon is-lg">
                  <Icon name={a.icon} size={24} />
                </span>
                <h3>{a.who}</h3>
                <p>{a.text}</p>
                <ul>
                  {a.points.map((pt) => (
                    <li key={pt}>
                      <Icon name="check" size={15} />
                      {pt}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </Reveal>
        </section>

        {/* ---------- Get your numbers ---------- */}
        <section className="pc-a-section pc-a-tests" aria-labelledby="a-tests">
          <SectionHead
            id="a-tests"
            center
            eyebrow="Before you start · Bangladesh"
            title="Which tests do I need?"
            text={GET_NUMBERS.intro}
          />
          <Reveal as="p" className="pc-a-tests-min">
            <Icon name="check" size={16} /> {GET_NUMBERS.minimum}
          </Reveal>
          <Reveal as="ol" className="pc-a-steps">
            {GET_NUMBERS.steps.map((s, i) => (
              <li key={s.n} style={{ '--i': i }}>
                <span className="pc-a-step-n" aria-hidden="true">
                  {s.n}
                </span>
                <h3>{s.title}</h3>
                <p className="pc-a-step-where">{s.where}</p>
                {s.items.length > 0 ? (
                  <ul>
                    {s.items.map((it) => (
                      <li key={it.name}>
                        <strong>{it.name}</strong>
                        <span>{it.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pc-a-step-ask">
                    Ask for: <strong>{GET_NUMBERS.askFor}</strong>
                  </p>
                )}
              </li>
            ))}
          </Reveal>
          {/* The full per-test detail stays one click away instead of filling the page. */}
          <details className="pc-a-labs-more">
            <summary>
              <Icon name="flask" size={16} /> Test-by-test details: preparation and report units
            </summary>
          <Reveal as="ul" className="pc-a-labs" aria-label="Tests to ask the lab for">
            {GET_NUMBERS.tests.map((t, i) => (
              <li key={t.ask} className={t.required ? 'is-required' : ''} style={{ '--i': i }}>
                <header>
                  <span className="pc-a-icon">
                    <Icon name="flask" size={18} />
                  </span>
                  <h3>{t.ask}</h3>
                  <span className="pc-a-lab-tag">{t.required ? 'Required' : 'Optional'}</span>
                </header>
                <dl>
                  <dt>Fills in</dt>
                  <dd>{t.fields}</dd>
                  <dt>Before the test</dt>
                  <dd>{t.prep}</dd>
                  <dt>On your report</dt>
                  <dd>{t.report}</dd>
                </dl>
              </li>
            ))}
          </Reveal>
          </details>
          <Reveal className="pc-a-tests-foot">
            <p className="pc-a-tests-warn" role="note">
              <Icon name="warn" size={18} /> {GET_NUMBERS.safety}
            </p>
            <p className="pc-a-tests-note">{GET_NUMBERS.note}</p>
            <L {...linkProps(L, '/prediction')} className="pc-a-btn">
              I have my report: enter it <span className="pc-hero-cta-arrow" aria-hidden="true">→</span>
            </L>
          </Reveal>
        </section>

        {/* ---------- Inputs ---------- */}
        <section className="pc-a-section pc-a-inputs" aria-labelledby="a-inputs">
          <SectionHead
            id="a-inputs"
            center
            eyebrow="What the model looks at"
            title="21 routine measurements"
            text="21 values you enter; BMI and max heart rate are calculated."
          />
          <div className="pc-a-pills" role="group" aria-label="Filter inputs by group">
            {INPUT_GROUPS.map((g) => (
              <button key={g} type="button" className="pc-filter" aria-pressed={group === g} onClick={() => setGroup(g)}>
                {g}
                {g !== 'All' && <span className="pc-a-pill-count">{INPUTS.filter((i) => i.group === g).length}</span>}
              </button>
            ))}
          </div>
          <ul className="pc-a-grid">
            {shownInputs.map((input, i) => (
              <li key={`${group}-${input.name}`} className={`pc-a-tile is-${input.kind ?? 'measure'}`} style={{ '--i': i }}>
                <span className="pc-a-tile-icon">
                  <Icon name={input.kind ?? 'measure'} size={18} />
                </span>
                <span className="pc-a-tile-text">
                  <span className="pc-a-tile-name">{input.name}</span>
                  <span className="pc-a-tile-unit">{input.unit}</span>
                  {input.note && <span className="pc-a-tile-note">{input.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          <ul className="pc-a-legend" aria-label="Legend">
            <li className="is-measure">Measured</li>
            <li className="is-yesno">Yes / no</li>
            <li className="is-derived">Calculated for you</li>
            <li className="is-marker">Checked, not modelled</li>
          </ul>
        </section>

        {/* ---------- The science ---------- */}
        <section className="pc-a-science" aria-labelledby="a-model">
          <SectionHead
            id="a-model"
            light
            eyebrow="Under the hood"
            title="How the model was built"
            text="A standard, auditable pipeline: what was tested is what runs."
          />
          <Reveal as="ol" className="pc-pipeline">
            {PIPELINE.map((p, i) => (
              <li key={p.title} style={{ '--i': i }}>
                <span className="pc-pipeline-n">{i + 1}</span>
                <span className="pc-pipeline-title">{p.title}</span>
                <b>{p.value}</b>
                <span className="pc-pipeline-text">{p.text}</span>
              </li>
            ))}
          </Reveal>

          <div className="pc-a-science-grid">
            <div className="pc-a-results">
              <p className="pc-a-eyebrow">Held-out test · 207 patients · internal validation only</p>
              <ul ref={metricsRef} className="pc-a-metrics">
                {METRICS.map((m) => (
                  <li key={m.label}>
                    <b>
                      <CountUp value={m.value} start={metricsIn} digits={m.digits} suffix={m.suffix ?? ''} separator={false} />
                    </b>
                    <span>{m.label}</span>
                  </li>
                ))}
              </ul>
              <p className="pc-a-caveat">
                Scores this high on one hospital’s data very likely overstate real-world performance. Treat them as dataset-specific, not as clinical
                accuracy.
              </p>
            </div>
            <div className="pc-a-method">
              {METHOD.map(([term, desc], i) => (
                <details key={term} open={i === 0}>
                  <summary>
                    {term}
                    <span className="pc-a-plus" aria-hidden="true" />
                  </summary>
                  <p>{desc}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="pc-a-transparency">
            <div>
              <h3>Transparency report</h3>
              <p>What this model can’t do, stated up front.</p>
            </div>
            <ul>
              {LIMITATIONS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
          <p className="pc-a-disclaimer">
            <Icon name="warn" size={18} />
            {DISCLAIMER}
          </p>
        </section>

        {/* ---------- Trust ---------- */}
        <section className="pc-a-section" aria-labelledby="a-trust">
          <SectionHead
            id="a-trust"
            eyebrow="Privacy & trust"
            title="Health data deserves care"
            text="Enforced in the code, not just promised."
          />
          <Reveal as="ul" className="pc-a-trust">
            {TRUST.map((t, i) => (
              <li key={t.title} style={{ '--i': i }}>
                <span className="pc-a-icon">
                  <Icon name={t.icon} />
                </span>
                <div>
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                </div>
              </li>
            ))}
          </Reveal>
          <div className="pc-a-stack">
            <span>Built with</span>
            <ul>
              {STACK.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Journey ---------- */}
        <section className="pc-a-section pc-a-journey-wrap" aria-labelledby="a-journey">
          <SectionHead id="a-journey" eyebrow="Our journey" title="Built step by step" text="Every milestone is in the commit history." />
          {/* One column per milestone on wide screens, however many there are. */}
          <Reveal as="ol" className="pc-a-journey" style={{ '--n': JOURNEY.length }}>
            {JOURNEY.map((j, i) => (
              <li key={j.title} className={j.date ? undefined : 'is-next'} style={{ '--i': i }}>
                <time dateTime={j.date ?? undefined}>{j.date ? fmtDay(j.date) : 'Up next'}</time>
                <h3>{j.title}</h3>
                <p>{j.text}</p>
              </li>
            ))}
          </Reveal>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="pc-a-section pc-a-faq-wrap" aria-labelledby="a-faq">
          <div className="pc-a-faq-side">
            <SectionHead id="a-faq" eyebrow="FAQ" title="Questions, answered" text="The things people ask first." />
          </div>
          <div className="pc-a-faq">
            {FAQ.map((f, i) => (
              <details key={f.q} name="about-faq" open={i === 0}>
                <summary>
                  {f.q}
                  <span className="pc-a-plus" aria-hidden="true" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Call to action ---------- */}
        <Reveal as="section" className="pc-a-cta" aria-labelledby="a-cta">
          <span className="pc-a-cta-glow" aria-hidden="true" />
          <p className="pc-a-eyebrow">Free research prototype</p>
          <h2 id="a-cta">See what your numbers say</h2>
          <p>Enter routine values and get a calibrated estimate, what moved it and what to do next, in about a minute.</p>
          <div className="pc-a-cta-actions">
            <L {...linkProps(L, '/prediction')} className="pc-a-btn pc-a-btn--light">
              Run a prediction <span className="pc-hero-cta-arrow" aria-hidden="true">→</span>
            </L>
            <a href="#a-faq" className="pc-a-cta-link">
              Read the FAQ
            </a>
          </div>
        </Reveal>
      </main>

      <SiteFooter LinkComponent={LinkComponent} activePath={activePath} />
    </div>
  );
}
