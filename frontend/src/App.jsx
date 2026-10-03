import { Suspense, forwardRef, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home/Home';
import ErrorBoundary, { lazyPage } from './components/ErrorBoundary';

// Every page but the homepage is downloaded the first time it's opened, so the
// first load only fetches what it shows. lazyPage reloads once onto the new
// version if a redeploy has replaced the page's files (components/ErrorBoundary.jsx).
const Dashboard = lazyPage(() => import('./pages/Dashboard/Dashboard'));
const Prediction = lazyPage(() => import('./pages/Prediction/Prediction'));
const History = lazyPage(() => import('./pages/History/History'));
const About = lazyPage(() => import('./pages/About/About'));
const Profile = lazyPage(() => import('./pages/Profile/Profile'));
const Guidance = lazyPage(() => import('./pages/Guidance/Guidance'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword/ResetPassword'));
const Console = lazyPage(() => import('./pages/Admin/Console'));
import DemoBanner from './components/DemoBanner';
import SiteBanner from './components/SiteBanner';
import { AuthProvider, RequireAuth, useAuth } from './auth/AuthContext';
import { NotificationsProvider } from './notifications/NotificationsContext';
import NavBar from './components/NavBar';
import { predict } from './api/predictionApi';
import { getProfile } from './api/profileApi';
import { getHistory } from './api/historyApi';
import { dashboardFrom } from './pages/Dashboard/latest';

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

// Everything on the overview comes from the user's own assessments; a new
// account sees empty states until its first prediction.
function DashboardRoute(props) {
  const records = useHistory();
  if (!records) return <LoadingShell {...props} />; // no flash of empty cards before the real ones
  return <Dashboard {...props} data={dashboardFrom(Array.isArray(records) ? records : [])} />;
}

// The health report on the Profile page lists the user's own assessments.
function ProfileRoute(props) {
  const records = useHistory();
  return <Profile {...props} records={Array.isArray(records) ? records : []} />;
}

// "/" is the homepage, the way into the app. Anyone already signed in when
// they arrive goes to the Dashboard; someone signing in here stays until the
// page's loader sends them on.
function LandingRoute(props) {
  const { user } = useAuth();
  const arrivedSignedIn = useRef(undefined);
  if (arrivedSignedIn.current === undefined && user !== undefined) arrivedSignedIn.current = Boolean(user);
  if (user === undefined) return null; // still checking the session
  if (arrivedSignedIn.current && user) return <Navigate to="/dashboard" replace />;
  return <Home {...props} />;
}

const guard = (element) => <RequireAuth>{element}</RequireAuth>;

function AppRoutes() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user: account } = useAuth();
  // The saved profile's name shows in the nav avatar on every page.
  const [profile, setProfile] = useState(null);
  const signedIn = Boolean(account);
  useEffect(() => {
    if (!signedIn) {
      setProfile(null);
      return;
    }
    getProfile().then(setProfile).catch(() => {});
  }, [signedIn]);
  const user = { name: profile?.full_name || account?.name || 'Demo User', photo: profile?.photo };
  const shared = { LinkComponent: TransitionLink, activePath: pathname, user };

  return (
    // Keyed on the account, so a different user never sees the last one's notifications.
    <NotificationsProvider key={account?.email ?? 'signed-out'} profile={profile} account={account?.email}>
      <SiteBanner />
      <DemoBanner />
      <ScrollToTop />
      {/* A page that fails to draw shows what happened and a way out, never a blank screen. */}
      <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<LoadingShell {...shared} />}>
      <Routes>
        <Route path="/" element={<LandingRoute {...shared} />} />
        <Route path="/dashboard" element={guard(<DashboardRoute {...shared} />)} />
        {/* Anyone can look; running a prediction needs an account. */}
        <Route
          path="/prediction"
          element={
            <Prediction
              {...shared}
              predict={predict}
              signedIn={signedIn}
              onRequireLogin={() =>
                navigate('/', { state: { auth: 'login', reason: 'run', from: { pathname: '/prediction' } } })
              }
            />
          }
        />
        <Route path="/history" element={guard(<HistoryRoute {...shared} />)} />
        <Route path="/about" element={<About {...shared} />} />
        <Route path="/profile" element={guard(<ProfileRoute {...shared} account={account} onProfileChange={setProfile} />)} />
        <Route path="/guidance" element={guard(<Guidance {...shared} />)} />
        <Route path="/reset-password" element={<ResetPassword {...shared} />} />
        {/* Admin console: staff only (it checks, and so does every API call). */}
        {/* Its own fallback: the console has a different shell, so don't flash the app's nav while it loads. */}
        <Route
          path="/console/*"
          element={
            <Suspense fallback={null}>
              <Console />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </NotificationsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
