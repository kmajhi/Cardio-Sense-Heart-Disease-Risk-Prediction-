import { useEffect, useState } from 'react';
import NavBar, { HeartMark } from '../Dashboard/components/NavBar';
import HeartHero from '../Dashboard/components/HeartHero';
import { linkProps } from '../Dashboard/link';
import CountUp from './components/CountUp';
import PhoneMocks from './components/PhoneMocks';
import useInView from './components/useInView';
import {
  DISCLAIMER,
  FACTS,
  FEATURES,
  HERO,
  INPUTS,
  INPUT_GROUPS,
  LIMITATIONS,
  METHOD,
  METRICS,
  STEPS,
} from './content';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, hero orb, page wipe
import './About.css';

const ICONS = {
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  flask: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 14h9" />,
  puzzle: <path d="M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4v-4a2 2 0 1 0 0-4V8Z" />,
  shield: <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3ZM9 12l2 2 4-4" />,
  measure: <path d="M4 16a8 8 0 1 1 16 0M12 16l4-5" />,
  yesno: <path d="M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8ZM17 12h.01" />,
  derived: <path d="M5 19 19 5M7 5h4M9 3v4M13 17h4" />,
  marker: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />,
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** A section heading that rises in when scrolled to. */
function SectionHead({ eyebrow, title, text, center = false, id }) {
  const [ref, inView] = useInView();
  return (
    <header ref={ref} className={`pc-a-head${center ? ' is-center' : ''}${inView ? ' is-in' : ''}`}>
      <p className="pc-a-eyebrow">{eyebrow}</p>
      <h2 id={id} className="pc-a-h2">
        {title}
      </h2>
      {text && <p className="pc-a-text">{text}</p>}
    </header>
  );
}

/**
 * Cardio Sense — About page. A scrolling story in the reference's order:
 * hero → how it works (phones) → inputs grid → key features → how it was
 * built → call to action → footer.
 */
export default function About({ user = { name: 'Demo User' }, hasNotifications = false, LinkComponent = 'a', activePath = '/about' }) {
  const L = LinkComponent;
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

  const [factsRef, factsIn] = useInView({ threshold: 0.4 });
  const [stepsRef, stepsIn] = useInView({ threshold: 0.25 });
  const [gridRef, gridIn] = useInView({ threshold: 0.1 });
  const [featRef, featIn] = useInView({ threshold: 0.2 });
  const [metricsRef, metricsIn] = useInView({ threshold: 0.35 });
  const [ctaRef, ctaIn] = useInView({ threshold: 0.3 });

  const shownInputs = INPUTS.filter((i) => group === 'All' || i.group === group);

  return (
    <div className={`pc-dash pc-about${ready ? ' is-ready' : ''}${scrolled ? ' is-scrolled' : ''}`}>
      <NavBar user={user} hasNotifications={hasNotifications} activePath={activePath} LinkComponent={LinkComponent} />

      <main className="pc-a-main">
        {/* ---------- Hero ---------- */}
        <section className="pc-a-hero" aria-labelledby="a-title">
          <div className="pc-a-hero-copy">
            <p className="pc-a-eyebrow pc-enter" style={{ '--d': '80ms' }}>
              About Cardio Sense
            </p>
            <h1 id="a-title" className="pc-a-h1">
              {HERO.lines.map((line, i) => (
                <span key={line.text} className={`pc-wipe pc-${line.weight}`} style={{ '--d': `${140 + i * 160}ms` }}>
                  {line.text}
                </span>
              ))}
            </h1>
            <p className="pc-a-lead pc-enter" style={{ '--d': '520ms' }}>
              {HERO.lead}
            </p>
            <div className="pc-a-hero-actions pc-enter" style={{ '--d': '620ms' }}>
              <L {...linkProps(L, '/prediction')} className="pc-a-btn">
                Run a prediction <span className="pc-hero-cta-arrow" aria-hidden="true">→</span>
              </L>
              <a href="#a-how" className="pc-a-link">
                How it works ↓
              </a>
            </div>
          </div>
          <div className="pc-a-hero-art">
            <HeartHero LinkComponent={LinkComponent} />
          </div>
        </section>

        {/* The reference's brand-logo strip, as facts about the model. */}
        <ul ref={factsRef} className={`pc-a-facts${factsIn ? ' is-in' : ''}`} aria-label="Cardio Sense in numbers">
          {FACTS.map((f, i) => (
            <li key={f.label} style={{ '--i': i }}>
              <b>
                <CountUp value={f.value} start={factsIn} duration={1100} />
              </b>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>

        {/* ---------- How it works (phones) ---------- */}
        <section ref={stepsRef} className="pc-a-how" aria-labelledby="a-how">
          <PhoneMocks inView={stepsIn} />
          <div className="pc-a-how-copy">
            <SectionHead
              id="a-how"
              eyebrow="How it works"
              title="Three steps, under a minute"
              text="Built around the measurements a district hospital already takes. No imaging, no specialist tests."
            />
            <ol className={`pc-a-steps${stepsIn ? ' is-in' : ''}`}>
              {STEPS.map((s, i) => (
                <li key={s.title} style={{ '--i': i }}>
                  <span className="pc-a-step-n">0{i + 1}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Inputs grid (the reference's fleet grid) ---------- */}
        <section className="pc-a-inputs" aria-labelledby="a-inputs">
          <SectionHead
            id="a-inputs"
            center
            eyebrow="What the model looks at"
            title="21 routine measurements"
            text="The same inputs the model was trained on: 21 that you enter, plus BMI and max heart rate, which are calculated for you. Troponin-I always travels with its assay type."
          />
          <div className="pc-a-pills" role="group" aria-label="Filter inputs by group">
            {INPUT_GROUPS.map((g) => (
              <button key={g} type="button" className="pc-filter" aria-pressed={group === g} onClick={() => setGroup(g)}>
                {g}
                {g !== 'All' && <span className="pc-a-pill-count">{INPUTS.filter((i) => i.group === g).length}</span>}
              </button>
            ))}
          </div>
          <ul ref={gridRef} className={`pc-a-grid${gridIn ? ' is-in' : ''}`}>
            {shownInputs.map((input, i) => (
              <li key={`${group}-${input.name}`} className={`pc-a-tile is-${input.kind ?? 'measure'}`} style={{ '--i': i, '--row': Math.floor(i / 4) }}>
                <div className="pc-a-tile-inner">
                  <span className="pc-a-tile-icon">
                    <Icon name={input.kind ?? 'measure'} />
                  </span>
                  <span className="pc-a-tile-name">{input.name}</span>
                  <span className="pc-a-tile-unit">{input.unit}</span>
                  {input.note && <span className="pc-a-tile-note">{input.note}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Key features (cascading cards) ---------- */}
        <section className="pc-a-features" aria-labelledby="a-features">
          <SectionHead
            id="a-features"
            eyebrow="Built for real clinics"
            title="Key features"
            text="Designed around what goes wrong in practice: missing tests, mixed lab units, and numbers people can't question."
          />
          <ul ref={featRef} className={`pc-a-cards${featIn ? ' is-in' : ''}`}>
            {FEATURES.map((f, i) => (
              <li key={f.title} className="pc-a-card" style={{ '--i': i }}>
                <span className="pc-a-card-icon">
                  <Icon name={f.icon} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- How it was built + limitations ---------- */}
        <section ref={metricsRef} className={`pc-a-model${metricsIn ? ' is-in' : ''}`} aria-labelledby="a-model">
          <div className="pc-a-model-method">
            <SectionHead id="a-model" eyebrow="Under the hood" title="How it was built" />
            <dl className="pc-a-method">
              {METHOD.map(([term, desc], i) => (
                <div key={term} style={{ '--i': i }}>
                  <dt>{term}</dt>
                  <dd>{desc}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="pc-a-model-results">
            <p className="pc-a-eyebrow">Held-out test · 207 patients</p>
            <ul className="pc-a-metrics">
              {METRICS.map((m, i) => (
                <li key={m.label} style={{ '--i': i }}>
                  <b>
                    <CountUp value={m.value} start={metricsIn} digits={m.digits} suffix={m.suffix ?? ''} separator={false} />
                  </b>
                  <span>{m.label}</span>
                </li>
              ))}
            </ul>
            <p className="pc-a-caveat">
              Scores this high on one hospital's data very likely overstate real-world performance. Treat them as
              dataset-specific, not as clinical accuracy.
            </p>
            <h3 className="pc-a-h3">Limitations</h3>
            <ul className="pc-a-limits">
              {LIMITATIONS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="pc-a-disclaimer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 3 3 19h18L12 3Z" strokeLinejoin="round" />
                <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
              </svg>
              {DISCLAIMER}
            </p>
          </div>
        </section>

        {/* ---------- Call to action ---------- */}
        <section ref={ctaRef} className={`pc-a-cta${ctaIn ? ' is-in' : ''}`} aria-labelledby="a-cta">
          <span className="pc-a-cta-glow" aria-hidden="true" />
          <h2 id="a-cta">Try an explained estimate</h2>
          <p>Enter a patient's routine values and see the estimate, and what moved it, in under a minute.</p>
          <L {...linkProps(L, '/prediction')} className="pc-a-btn pc-a-btn--light">
            Run a prediction <span className="pc-hero-cta-arrow" aria-hidden="true">→</span>
          </L>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="pc-a-footer">
        <div className="pc-a-footer-brand">
          <L {...linkProps(L, '/')} className="pc-a-footer-logo">
            <HeartMark /> Cardio Sense
          </L>
          <p>AI-assisted heart disease risk estimation for resource-limited clinics. A final-year CSE capstone project.</p>
        </div>
        <nav aria-label="Footer" className="pc-a-footer-nav">
          <div>
            <h3>Product</h3>
            <L {...linkProps(L, '/')}>Dashboard</L>
            <L {...linkProps(L, '/prediction')}>Prediction</L>
            <L {...linkProps(L, '/history')}>History</L>
          </div>
          <div>
            <h3>Project</h3>
            <L {...linkProps(L, '/about')}>About</L>
            <a href="#a-model">How it was built</a>
            <a href="#a-inputs">Model inputs</a>
          </div>
        </nav>
        <p className="pc-a-footer-legal">
          © 2026 Cardio Sense · {DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}
