import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HeartMark } from './NavBar';
import RingLoader from './RingLoader';
import { alreadyBooted, markBooted } from './boot';

const HOLD = 1300; // ms
const EXIT = 400; // ms, the loader's exit animation (Home.css → .hm-loader.out)

// Home plays its own launch loader (timed with the hero video); the admin
// console and the Doctor Panel are tools with their own look.
const handledElsewhere = (path) => path === '/' || path.startsWith('/console') || path.startsWith('/doctor');

/**
 * The launch loader for a first visit that lands on any other patient page
 * (e.g. a shared link to /about or /prediction). Once per browser session,
 * like Home's. Same look as Home's (Home.css .hm-loader).
 */
export default function BootScreen() {
  const { pathname } = useLocation();
  const [phase, setPhase] = useState(() => (handledElsewhere(pathname) || alreadyBooted() ? 'off' : 'on'));

  useEffect(() => {
    if (phase !== 'on') return undefined;
    markBooted();
    const out = setTimeout(() => setPhase('out'), HOLD);
    const off = setTimeout(() => setPhase('off'), HOLD + EXIT);
    return () => {
      clearTimeout(out);
      clearTimeout(off);
    };
    // Runs once, for the page the visitor arrived on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'off') return null;
  return (
    <div className={`hm-loader hm-loader--boot${phase === 'out' ? ' out' : ''}`} role="status" aria-live="polite" aria-label="Loading Cardio Sense">
      <RingLoader size={132} className="hm-lring" />
      <span className="hm-lw" aria-hidden="true">
        <HeartMark className="hm-lmark" />
        <span className="hm-lword">
          {'Cardio Sense'.split('').map((ch, i) => (
            <span key={i} className="hm-lc" style={{ '--i': i }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </span>
      </span>
      <span className="hm-lcap">Loading…</span>
    </div>
  );
}
