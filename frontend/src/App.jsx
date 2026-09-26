import { forwardRef, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard/Dashboard';
import Prediction from './pages/Prediction/Prediction';
import History from './pages/History/History';
import About from './pages/About/About';
import Profile from './pages/Profile/Profile';
import { predict } from './api/predictionApi';
import { getProfile } from './api/profileApi';

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
        <Route path="/" element={<Dashboard {...shared} />} />
        <Route path="/prediction" element={<Prediction {...shared} predict={predict} />} />
        <Route path="/history" element={<History {...shared} />} />
        <Route path="/about" element={<About {...shared} />} />
        <Route path="/profile" element={<Profile {...shared} onProfileChange={setProfile} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
