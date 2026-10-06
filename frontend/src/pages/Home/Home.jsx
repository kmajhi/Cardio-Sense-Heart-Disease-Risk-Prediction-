import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NavBar, { HeartMark } from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
import { linkProps } from '../../components/link';
import { DISCLAIMER, FACTS, METRICS, STEPS } from '../About/content';
import { useAuth } from '../../auth/AuthContext';
import { signInErrorMessage } from '../../api/authApi';
import AuthModal from './AuthModal';
import RingLoader from '../../components/RingLoader';
import { alreadyBooted, markBooted } from '../../components/boot';
import heroVideo from '../../assets/hero-heart.mp4';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, panel, load sequence, page wipe
import './Home.css';

const SCENE_SWITCH = 3.72; // s into the clip where headline A hands over to headline B
const LAUNCH_HOLD = 1600; // ms the launch loader holds (first visit of a session only): about one turn of the ring
const LOADER_EXIT = 400; // ms of the loader's exit animation (Home.css → .hm-loader.out)

const DEFAULT_GATE = {
  title: 'Sign in to continue',
  text: 'This page holds your personal health data. Log in, or create a free account if you’re new.',
};
const DASHBOARD_GATE = {
  title: 'Sign in to see your dashboard',
  text: 'Your dashboard holds your personal health data. Log in, or create a free account if you’re new.',
  target: '/dashboard',
};
const EXPIRED_GATE = {
  title: 'Your session has ended',
  text: 'For your privacy you were signed out after a while. Log in again to carry on where you were.',
};
/** ?auth=login&next=/profile → the same shape as router state. `next` must be a local path. */
function stateFromQuery(search) {
  const params = new URLSearchParams(search);
  const auth = params.get('auth');
  if (auth !== 'login' && auth !== 'register') return null;
  const next = params.get('next') ?? '';
  const local = next.startsWith('/') && !next.startsWith('//');
  // A Google / X sign-in that came back refused (backend/predictor/social_login.py).
  const error = params.get('auth_error');
  return {
    auth,
    ...(local ? { from: { pathname: next } } : {}),
    ...(error ? { error: signInErrorMessage(error, params.get('provider')) } : {}),
  };
}

const RUN_GATE = {
  title: 'Sign in to run a prediction',
  text: 'Your values are kept. Log in, or create a free account, and the prediction runs and is saved to your History.',
  target: '/prediction',
};

// Headline scenes; the video decides which one shows. `d` staggers the words.
const SCENES = {
  a: [['Predict', 'heart'], ['disease', 'risk'], ['in', 'seconds']],
  b: [['Every', 'estimate,'], ['explained'], ['factor', 'by', 'factor']],
};

const auc = METRICS.find((m) => m.label === 'ROC-AUC');
const accuracy = METRICS.find((m) => m.label === 'Accuracy');
const patients = FACTS.find((f) => f.label === 'adult patient records');
const measures = FACTS.find((f) => f.label === 'routine measurements');

function Headline({ id, words, cls, hidden, as: Tag }) {
  let d = 0;
  return (
    <Tag id={id} className={`hm-hl ${cls}`} aria-hidden={hidden}>
      {words.map((line, i) => (
        <span key={i} className={i === words.length - 1 ? 'hm-hl-bold' : undefined}>
          {line.map((w, j) => (
            <span key={j}>
              {j > 0 && ' '}
              <span className={`w d${d++}`}>{w}</span>
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}

/**
 * Cardio Sense — Home, the landing page at "/". Same nav, panel and cards as
 * the Dashboard: what the project does, the heart video in its own card, and
 * the model's headline figures. Log in / Register open the auth dialog; so do
 * See Dashboard and pages that need an account (they send `state.from` or
 * `state.auth` here).
 */
export default function Home({ user, LinkComponent = 'a', activePath = '/' }) {
  const { user: account, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const L = LinkComponent;

  // Sent here to sign in (a protected page, Log in elsewhere, or ?auth=login):
  // skip the launch intro so the login card shows straight away.
  const arrivingToSignIn = useRef(
    Boolean(location.state?.from || location.state?.auth || stateFromQuery(location.search)),
  );
  const booted = useRef(alreadyBooted() || arrivingToSignIn.current);
  const [ready, setReady] = useState(booted.current);
  const [scene, setScene] = useState('a');
  const [seen, setSeen] = useState(false);
  const [modal, setModal] = useState(null); // null | 'login' | 'register'
  const [gate, setGate] = useState(null); // what a sign-in unlocks
  const [authError, setAuthError] = useState(''); // a refused Google / X sign-in
  const [loader, setLoader] = useState(booted.current ? null : { mode: 'boot', msg: '' });
  const [loaderOut, setLoaderOut] = useState(false);

  const videoRef = useRef(null);
  const sceneRef = useRef('a');
  const seenRef = useRef(false);
  const loadTimers = useRef([]);

  // Shows the Cardio Sense loader for `hold` ms, then plays its exit and calls `done`.
  const runLoader = useCallback((mode, msg, hold, done) => {
    loadTimers.current.forEach(clearTimeout);
    setLoader({ mode, msg });
    setLoaderOut(false);
    loadTimers.current = [
      setTimeout(() => setLoaderOut(true), hold),
      setTimeout(() => {
        setLoader(null);
        setLoaderOut(false);
        done?.();
      }, hold + LOADER_EXIT),
    ];
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    const play = () => videoRef.current?.play()?.catch?.(() => {});
    if (v) {
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
    }
    if (booted.current) play();
    else {
      // Launch: hold the loader while the hero video buffers, then reveal the page.
      v?.pause();
      runLoader('boot', '', LAUNCH_HOLD, () => {
        markBooted();
        setReady(true);
        if (videoRef.current) videoRef.current.currentTime = 0;
        play();
      });
    }

    // The headline follows the video: scene A before SCENE_SWITCH, B after.
    let raf = 0;
    const tick = () => {
      const vid = videoRef.current;
      const t = vid && vid.readyState > 1 ? vid.currentTime : 0;
      const next = t >= SCENE_SWITCH ? 'b' : 'a';
      if (next !== sceneRef.current) {
        sceneRef.current = next;
        setScene(next);
        if (next === 'b' && !seenRef.current) {
          seenRef.current = true;
          setSeen(true);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Save battery: pause while the tab is hidden.
    const onVisibility = () => (document.hidden ? videoRef.current?.pause() : play());
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      loadTimers.current.forEach(clearTimeout);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [runLoader]);

  // Sent here to sign in: by a page that needs an account (state.from), by a
  // Log in / Register button on another page (state.auth), to run a prediction,
  // or by the server (?auth=login&next=/profile, e.g. linking an account while signed out).
  const state = location.state ?? stateFromQuery(location.search);
  useEffect(() => {
    if (!ready || account !== null || !(state?.from || state?.auth)) return;
    if (state.reason === 'run') setGate(RUN_GATE);
    else if (state.from) {
      const target = `${state.from.pathname}${state.from.search ?? ''}${state.from.hash ?? ''}`;
      const gate = state.reason === 'expired' ? EXPIRED_GATE : DEFAULT_GATE;
      setGate(state.from.pathname === DASHBOARD_GATE.target && !state.reason ? DASHBOARD_GATE : { ...gate, target });
    } else setGate(null);
    setAuthError(state.error ?? '');
    setModal(state.auth === 'register' ? 'register' : 'login');
    navigate(location.pathname, { replace: true, state: null }); // a refresh won't reopen it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account, location.state, location.search, navigate, location.pathname]);

  // The login/register card is shown on its own: nothing behind it plays.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !ready) return;
    if (modal) v.pause();
    else if (!document.hidden) v.play()?.catch?.(() => {});
  }, [modal, ready]);

  const go = (to) => navigate(to, { viewTransition: true });

  const openAuth = (mode) => {
    setGate(null);
    setModal(mode);
  };

  // Doctors sign in on their own portal; User / Patient (admins included) use this window.
  const chooseRole = (next) => {
    if (next !== 'doctor') return;
    setModal(null);
    setGate(null);
    go('/doctor');
  };

  const seeDashboard = (e) => {
    e.preventDefault();
    if (account) go(DASHBOARD_GATE.target); // straight there: no loading screen to sit through
    else {
      setGate(DASHBOARD_GATE);
      setModal('login');
    }
  };

  const closeModal = useCallback(() => {
    setModal(null);
    setGate(null);
    setAuthError('');
  }, []);

  // After signing in: go where the visitor was headed, otherwise the Dashboard.
  // Staff with nowhere particular to go land on the admin console.
  const onSignedIn = (how, account) => {
    const wasGate = gate;
    setModal(null);
    setGate(null);
    // Straight to where they were going: no loading screen to sit through.
    go(wasGate?.target ?? (account?.is_staff ? '/console' : DASHBOARD_GATE.target));
  };

  const b = scene === 'b' ? 'on' : seen ? 'off' : 'idle';
  const aCls = scene === 'a' ? 'on' : 'off';

  return (
    <div className={`pc-dash pc-home${ready ? ' is-ready' : ' hm-booting'}${modal ? ' hm-auth-open' : ''}`}>
      <NavBar user={user} activePath={activePath} LinkComponent={LinkComponent} onAuth={openAuth} />

      <main>
        <div className="pc-stage">
          <section className="pc-panel hm-panel" aria-labelledby="hm-title">
            <div className="pc-fog" aria-hidden="true">
              <span style={{ '--d': '100ms' }} />
              <span style={{ '--d': '300ms' }} />
              <span style={{ '--d': '500ms' }} />
            </div>

            <div className="hm-copy">
              <span className="hm-eyebrow pc-enter" style={{ '--d': '80ms', '--pc-rise': '16px' }}>
                <span className="hm-ping" aria-hidden="true" />
                AI heart disease risk prediction
              </span>

              <div className="hm-heads">
                <Headline as="h1" id="hm-title" words={SCENES.a} cls={aCls} hidden={scene !== 'a'} />
                <Headline as="p" words={SCENES.b} cls={b} hidden={scene !== 'b'} />
              </div>

              <p className="hm-lede pc-enter" style={{ '--d': '420ms' }}>
                Cardio Sense turns routine clinical measurements (blood pressure, lipids, a basic blood panel and
                Troponin-I) into an explained estimate of heart disease risk, built for clinics where specialist tests
                are hard to reach.
              </p>

              <div className="hm-ctas pc-enter" style={{ '--d': '560ms', '--pc-rise': '20px' }}>
                {/* Make Prediction (from the CardioSense mockup) */}
                <L {...linkProps(L, '/prediction')} className="hm-predict">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      className="ecg"
                      d="M2 12h4l2.5-6 4 12 2.5-6h7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="pl">Make Prediction</span>
                </L>

                {/* See Dashboard: the mockup's notched pill with the violet dot */}
                <a href="/dashboard" className="hm-cta" aria-label="See Dashboard" onClick={seeDashboard}>
                  <span className="hm-cta-wrap">
                    <svg width="320" height="76" viewBox="0 0 320 76" aria-hidden="true">
                      <path
                        d="M36 2 H212 C232 2 240 16 252 21.2 A36 36 0 1 1 252 54.8 C240 60 232 74 212 74 H36 A36 36 0 0 1 36 2 Z"
                        fill="#ffffff"
                      />
                    </svg>
                    <span className="hm-cta-label">See Dashboard</span>
                  </span>
                  <span className="hm-cta-dot">
                    <svg className="hm-cta-arrow" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 18 L18 6 M8.5 6 H18 V15.5"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </a>
              </div>

              <dl className="hm-stats pc-enter" style={{ '--d': '680ms', '--pc-rise': '16px' }}>
                <div>
                  <dt>ROC-AUC</dt>
                  <dd>{auc.value.toFixed(auc.digits)}</dd>
                </div>
                <div>
                  <dt>Accuracy</dt>
                  <dd>
                    {accuracy.value.toFixed(accuracy.digits)}
                    <small>%</small>
                  </dd>
                </div>
                <div>
                  <dt>Patients</dt>
                  <dd>{patients.value.toLocaleString('en-US')}</dd>
                </div>
                <div>
                  <dt>Inputs</dt>
                  <dd>{measures.value}</dd>
                </div>
              </dl>
            </div>

            {/* The heart video, as the CardioSense mockup shows it: big, edges
                feathered into the panel, focusing in as the page opens. */}
            <div className="hm-visual">
              <div className="hm-clip">
                <video
                  ref={videoRef}
                  src={heroVideo}
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-hidden="true"
                  tabIndex={-1}
                  disablePictureInPicture
                />
              </div>

              <div className="hm-card hm-card--1">
                <div className="hm-card-body hm-bob">
                  <div className="hm-card-head">
                    <span className="hm-card-dot">
                      <span className="hm-ping" />
                    </span>
                    <span>
                      Risk
                      <br />
                      model
                    </span>
                  </div>
                  <div className="hm-card-big">Random Forest</div>
                  <div className="hm-card-small">{auc.value.toFixed(auc.digits)} ROC-AUC on held-out patients</div>
                </div>
              </div>

              <div className="hm-card hm-card--2">
                <div className="hm-card-body hm-bob2">
                  <div className="hm-card-head">
                    <span className="hm-card-dot">
                      <span className="hm-ping" />
                    </span>
                    <span>
                      Every
                      <br />
                      estimate
                    </span>
                  </div>
                  <div className="hm-card-big">Top 5 factors</div>
                  <div className="hm-card-small">that raised or lowered the risk</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ---------- How it works ---------- */}
        <section className="hm-section" aria-labelledby="hm-how">
          <header className="hm-section-head">
            <span className="hm-kicker">How it works</span>
            <h2 id="hm-how">
              <span className="pc-thin">From routine values to an</span> <span className="pc-bold">explained estimate</span>
            </h2>
          </header>
          <ol className="hm-steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className="hm-step">
                <span className="hm-step-n">{String(i + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Model at a glance ---------- */}
        <section className="hm-section" aria-labelledby="hm-model">
          <div className="hm-model">
            <div className="hm-model-copy">
              <span className="hm-kicker">The model</span>
              <h2 id="hm-model">
                <span className="pc-thin">Trained on</span> <span className="pc-bold">real hospital records</span>
              </h2>
              <p>
                Four models were compared on {patients.value.toLocaleString('en-US')} adult patient records from
                Northern Bangladesh. The random forest ranked first and is the one behind every estimate. Its scores
                below come from 207 patients it never saw during training.
              </p>
              <L {...linkProps(L, '/about')} className="hm-link">
                How it was built
                <span className="pc-hero-cta-arrow" aria-hidden="true">
                  →
                </span>
              </L>
            </div>
            <dl className="hm-metrics">
              {METRICS.map((m) => (
                <div key={m.label} className="hm-metric">
                  <dt>{m.label}</dt>
                  <dd>
                    {m.value.toFixed(m.digits)}
                    {m.suffix && <small>{m.suffix}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="hm-disclaimer">{DISCLAIMER} Estimates support, and never replace, a clinician’s judgement.</p>
        </section>
      </main>

      <SiteFooter LinkComponent={LinkComponent} activePath={activePath} />

      {modal && (
        <AuthModal
          mode={modal}
          gate={gate}
          onMode={setModal}
          onClose={closeModal}
          login={login}
          register={register}
          onSignedIn={onSignedIn}
          initialError={authError}
          onRole={chooseRole}
        />
      )}

      {/* loading screen: on launch and whenever the app is loading */}
      {loader && (
        <div
          className={`hm-loader hm-loader--${loader.mode}${loaderOut ? ' out' : ''}`}
          role="status"
          aria-live="polite"
          aria-label="Loading Cardio Sense"
        >
          <RingLoader size={132} className="hm-lring" />
          <span className="hm-lw" aria-hidden="true">
            <HeartMark className="hm-lmark" />
            <span className="hm-lword">
              {'Cardio Sense'.split('').map((ch, i) => (
                <span key={i} className="hm-lc" style={{ '--i': i }}>
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))}
            </span>
          </span>
          <span className="hm-lcap">{loader.msg || 'Loading…'}</span>
        </div>
      )}
    </div>
  );
}
