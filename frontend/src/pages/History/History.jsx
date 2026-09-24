import { useEffect, useState } from 'react';
import NavBar from '../Dashboard/components/NavBar';
import ScanCard from './components/ScanCard';
import GaugeCard from './components/GaugeCard';
import TrendCard from './components/TrendCard';
import LabTable from './components/LabTable';
import RecordList from './components/RecordList';
import { historyMock } from './historyMock';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, load sequence, page wipe
import './History.css';

/**
 * Cardio Sense — History page: overview, test results, assessment records.
 *
 * Props
 * - records:       assessments, oldest first: [{ id, created_at, inputs, result }].
 *                  `inputs` is the /api/predict/ request body and `result` its
 *                  response. Defaults to historyMock.js until the API exists.
 * - user, hasNotifications, LinkComponent, activePath: same as <Dashboard />.
 */
export default function History({
  records = historyMock,
  user = { name: 'Demo User' },
  hasNotifications = false,
  LinkComponent = 'a',
  activePath = '/history',
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const latest = records.at(-1);

  return (
    <div className={`pc-dash pc-history${ready ? ' is-ready' : ''}`}>
      <NavBar user={user} hasNotifications={hasNotifications} activePath={activePath} LinkComponent={LinkComponent} />

      <main className="pc-h-main">
        <header className="pc-h-head">
          <h1 className="pc-h-title">
            <span className="pc-wipe pc-thin" style={{ '--d': '120ms' }}>
              Health
            </span>{' '}
            <span className="pc-wipe pc-bold" style={{ '--d': '300ms' }}>
              history
            </span>
          </h1>
          <p className="pc-h-sub pc-enter" style={{ '--d': '200ms' }}>
            Past risk estimates and the test results behind them. Hover a card to replay it.
          </p>
        </header>

        {latest ? (
          <>
            <section className="pc-h-overview pc-enter" style={{ '--d': '260ms' }} aria-label="Overview">
              <ScanCard record={latest} />
              <GaugeCard record={latest} />
              <TrendCard records={records} />
            </section>

            <p className="pc-h-disclaimer pc-enter" style={{ '--d': '320ms' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 3 3 19h18L12 3Z" strokeLinejoin="round" />
                <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
              </svg>
              Research prototype. Not externally validated, not approved for clinical use. Risk figures are model
              estimates, not diagnoses.
            </p>

            <LabTable records={records} />
            <RecordList records={records} />
          </>
        ) : (
          <p className="pc-h-empty pc-enter">
            No assessments yet. Run a prediction and it will appear here with its test results.
          </p>
        )}
      </main>
    </div>
  );
}
