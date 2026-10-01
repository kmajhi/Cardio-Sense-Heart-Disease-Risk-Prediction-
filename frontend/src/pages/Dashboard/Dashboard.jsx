import { useEffect, useState } from 'react';
import NavBar from '../../components/NavBar';
import RecoveryChip from './components/RecoveryChip';
import RiskCard from './components/RiskCard';
import DashboardHeart from './components/DashboardHeart';
import CheckupsCard from './components/CheckupsCard';
import AssessmentsCard from './components/AssessmentsCard';
import HeartRateChart from './components/HeartRateChart';
import AlertCard from './components/AlertCard';
import BreathingPlayer from './components/BreathingPlayer';
import { dashboardFrom } from './latest';
import './Dashboard.css';

/**
 * PulseCheck — Heart health overview (Dashboard page).
 *
 * Props
 * - data:          dashboard payload: latest.js → dashboardFrom(records). dashboardMock.js
 *                  documents the shape (it's no longer bundled).
 * - LinkComponent: pass react-router's <Link> to get client-side navigation.
 *                  Defaults to a plain <a>.
 * - activePath:    which nav item is highlighted.
 * - user:          { name, photo } for the nav avatar.
 */
export default function Dashboard({
  data = dashboardFrom([]),
  LinkComponent = 'a',
  activePath = '/dashboard',
  user = { name: 'Demo User' },
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
        user={user}
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
              {data.risk ? `AI risk assessment, updated ${data.risk.updatedLabel}` : 'No risk assessment yet'}
            </p>
          </header>

          <RiskCard risk={data.risk} LinkComponent={LinkComponent} />

          <DashboardHeart LinkComponent={LinkComponent} />

          <div className="pc-side">
            {/* A signed-in user's own records (`recent`); the sample board otherwise. */}
            {data.recent && <AssessmentsCard records={data.recent} LinkComponent={LinkComponent} />}
            {data.appointments && <CheckupsCard appointments={data.appointments} />}
            {data.heartRate?.points?.length > 1 && <HeartRateChart points={data.heartRate.points} />}
            <AlertCard alert={data.alert} LinkComponent={LinkComponent} />
          </div>
        </section>

        <BreathingPlayer />
      </main>
    </div>
  );
}
