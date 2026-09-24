import { useEffect, useState } from 'react';
import NavBar from './components/NavBar';
import RecoveryChip from './components/RecoveryChip';
import RiskCard from './components/RiskCard';
import HeartHero from './components/HeartHero';
import CheckupsCard from './components/CheckupsCard';
import HeartRateChart from './components/HeartRateChart';
import AlertCard from './components/AlertCard';
import BreathingPlayer from './components/BreathingPlayer';
import { dashboardMock } from './dashboardMock';
import './Dashboard.css';

/**
 * PulseCheck — Heart health overview (Dashboard page).
 *
 * Props
 * - data:          dashboard payload (see dashboardMock.js for the expected shape).
 *                  Swap the mock for data from the Django REST API when it's ready.
 * - LinkComponent: pass react-router's <Link> to get client-side navigation.
 *                  Defaults to a plain <a>.
 * - activePath:    which nav item is highlighted.
 */
export default function Dashboard({
  data = dashboardMock,
  LinkComponent = 'a',
  activePath = '/',
}) {
  // Adding `is-ready` on the next frame triggers the one-time load sequence
  // (same choreography as the Figma "01 · Intro → 02 · Overview" transition).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={`pc-dash pc-overview${ready ? ' is-ready' : ''}`}>
      <NavBar
        user={data.user}
        hasNotifications={data.hasNotifications}
        activePath={activePath}
        LinkComponent={LinkComponent}
      />

      <main className="pc-stage">
        <RecoveryChip recovery={data.recovery} />

        <section className="pc-panel" aria-labelledby="pc-title">
          <div className="pc-fog" aria-hidden="true">
            <span style={{ '--d': '100ms' }} />
            <span style={{ '--d': '300ms' }} />
            <span style={{ '--d': '500ms' }} />
          </div>

          <header className="pc-head">
            {/* Each line wipes in from its right edge, thin word then heavy one. */}
            <h1 id="pc-title" className="pc-title">
              <span className="pc-wipe pc-thin" style={{ '--d': '150ms' }}>
                Heart health
              </span>
              <br />
              <span className="pc-wipe pc-bold" style={{ '--d': '380ms' }}>
                overview
              </span>
            </h1>
            <p className="pc-subtitle pc-enter" style={{ '--d': '160ms' }}>
              AI risk assessment, updated {data.risk.updatedLabel}
            </p>
          </header>

          <RiskCard risk={data.risk} LinkComponent={LinkComponent} />

          <HeartHero LinkComponent={LinkComponent} />

          <div className="pc-side">
            <CheckupsCard appointments={data.appointments} />
            <HeartRateChart points={data.heartRate.points} />
            <AlertCard alert={data.alert} LinkComponent={LinkComponent} />
          </div>
        </section>

        <BreathingPlayer />
      </main>
    </div>
  );
}
