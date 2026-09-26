import { forwardRef, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard/Dashboard';
import Prediction from './pages/Prediction/Prediction';
import History from './pages/History/History';
import About from './pages/About/About';
import Profile from './pages/Profile/Profile';
import { predict } from './api/predictionApi';
import { getProfile } from './api/profileApi';
import { getHistory } from './api/historyApi';
import { dashboardMock } from './pages/Dashboard/dashboardMock';
import { fromHistory } from './pages/Dashboard/latest';

// Router links with the View Transitions API, so client-side navigation gets
// the same circle wipe as full page loads (see Dashboard.css).
const TransitionLink = forwardRef(function TransitionLink(props, ref) {
  return <Link ref={ref} viewTransition {...props} />;
});

// Each page starts at the top, like a normal page load (hash links excepted).
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

// Fetched on every visit so assessments made since the last one show up.
// null while loading; { error } when the API can't be reached.
function useHistory() {
  const [records, setRecords] = useState(null);
  useEffect(() => {
    getHistory()
      .then(setRecords)
      .catch((err) => {
        console.error(err);
        setRecords({ error: err.message });
      });
  }, []);
  return records;
}

function HistoryRoute(props) {
  const records = useHistory();
  if (!records) return null;
  if (records.error) return <History {...props} records={[]} loadError={records.error} />;
  return <History {...props} records={records} />;
}

// The overview shows the latest saved assessment; the rest of the board is sample data.
function DashboardRoute(props) {
  const records = useHistory();
  if (!records) return null; // no flash of sample figures before the real ones
  const data = { ...dashboardMock, ...(Array.isArray(records) ? fromHistory(records) : {}) };
  if (Array.isArray(records)) data.hasNotifications = Boolean(data.alert);
  return <Dashboard {...props} data={data} />;
}

export default function App() {
  const { pathname } = useLocation();
  // The saved profile's name shows in the nav avatar on every page.
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
  }, []);
  const user = { name: profile?.full_name || 'Demo User', photo: profile?.photo };
  const shared = { LinkComponent: TransitionLink, activePath: pathname, user };

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<DashboardRoute {...shared} />} />
        <Route path="/prediction" element={<Prediction {...shared} predict={predict} />} />
        <Route path="/history" element={<HistoryRoute {...shared} />} />
        <Route path="/about" element={<About {...shared} />} />
        <Route path="/profile" element={<Profile {...shared} onProfileChange={setProfile} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
