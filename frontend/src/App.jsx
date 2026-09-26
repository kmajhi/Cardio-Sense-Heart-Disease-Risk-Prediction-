import { forwardRef, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard/Dashboard';
import Prediction from './pages/Prediction/Prediction';
import History from './pages/History/History';
import About from './pages/About/About';
import Profile from './pages/Profile/Profile';
import Guidance from './pages/Guidance/Guidance';
import { NotificationsProvider } from './notifications/NotificationsContext';
import NavBar from './pages/Dashboard/components/NavBar';
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

// Each page starts at the top, like a normal page load; a link with a #section
// (e.g. the footer's "/about#a-model") scrolls to that section once it renders.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    let tries = 0;
    let frame;
    const seek = () => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) target.scrollIntoView({ block: 'start' });
      else if (tries++ < 30) frame = requestAnimationFrame(seek); // the page may still be mounting
    };
    seek();
    return () => cancelAnimationFrame(frame);
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

// While a page's data loads, keep the nav on screen so it never blinks out.
function LoadingShell({ user, LinkComponent, activePath }) {
  return (
    <div className="pc-dash" aria-busy="true">
      <NavBar user={user} activePath={activePath} LinkComponent={LinkComponent} />
    </div>
  );
}

function HistoryRoute(props) {
  const records = useHistory();
  if (!records) return <LoadingShell {...props} />;
  if (records.error) return <History {...props} records={[]} loadError={records.error} />;
  return <History {...props} records={records} />;
}

// The overview shows the latest saved assessment; the rest of the board is sample data.
function DashboardRoute(props) {
  const records = useHistory();
  if (!records) return <LoadingShell {...props} />; // no flash of sample figures before the real ones
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
    <NotificationsProvider profile={profile}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<DashboardRoute {...shared} />} />
        <Route path="/prediction" element={<Prediction {...shared} predict={predict} />} />
        <Route path="/history" element={<HistoryRoute {...shared} />} />
        <Route path="/about" element={<About {...shared} />} />
        <Route path="/profile" element={<Profile {...shared} onProfileChange={setProfile} />} />
        <Route path="/guidance" element={<Guidance {...shared} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </NotificationsProvider>
  );
}
