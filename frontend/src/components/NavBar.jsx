import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { linkProps } from './link';
import NotificationsMenu from '../notifications/NotificationsMenu';
import NavWeather from './NavWeather';
import { useAuth } from '../auth/AuthContext';

// Signed in: the app. Home is only the way in, so it isn't listed.
const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Prediction', to: '/prediction' },
  { label: 'History', to: '/history' },
  { label: 'Ask a Doctor', to: '/ask-a-doctor' },
  { label: 'About', to: '/about' },
];
// Signed out: Home and the pages a visitor can look at.
const GUEST_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Prediction', to: '/prediction' },
  { label: 'About', to: '/about' },
];

/**
 * On narrow screens the links scroll sideways. Says which ends have links
 * hidden past them ({ start, end }), so the nav can fade that edge as a cue,
 * and scrolls the current page's link into view.
 */
function useScrollCue(activePath) {
  const ref = useRef(null);
  const [more, setMore] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setMore({ start: el.scrollLeft > 2, end: el.scrollLeft < max - 2 });
    };
    el.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [activePath]);
  return [ref, more];
}

/**
 * Phones (≤760px): the nav collapses to logo · bell · avatar · menu button,
 * and the button opens a full-screen menu. Open state, Escape, scroll lock and
 * focus handling live here; NavBar.css-style rules are in Dashboard.css.
 */
function useMobileMenu(activePath) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  // A new page closes it.
  useEffect(() => setOpen(false), [activePath]);

  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden'; // the page underneath stays put
    panelRef.current?.querySelector('[data-autofocus]')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Keep keyboard focus inside the menu while it's open.
      const items = [...panelRef.current.querySelectorAll('a[href], button:not([disabled])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Back on a wide screen (rotating a tablet): the menu has no place there.
    const wide = window.matchMedia?.('(min-width: 761px)');
    const onWide = (e) => e.matches && setOpen(false);
    window.addEventListener('keydown', onKey);
    wide?.addEventListener?.('change', onWide);
    const button = buttonRef.current;
    return () => {
      root.style.overflow = before;
      window.removeEventListener('keydown', onKey);
      wide?.removeEventListener?.('change', onWide);
      button?.focus({ preventScroll: true });
    };
  }, [open]);

  return { open, setOpen, buttonRef, panelRef };
}

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

// Cardio Sense logo: an anatomical heart with pulse rays, traced from the
// brand artwork into a vector (also saved as src/assets/cardio-sense-logo.svg).
// Uses currentColor, so its colour comes from CSS (--pc-brand).
const LOGO_BODY =
  'M95.73 33.00C96.15 32.59 96.12 32.53 97.00 32.53C97.88 32.53 100.00 32.62 101.00 33.00C102.00 33.38 102.75 32.67 103.00 34.83C103.25 37.00 102.42 43.81 102.49 46.00C102.57 48.19 101.54 47.27 103.46 48.00C105.38 48.73 110.91 50.94 114.00 50.38C117.09 49.82 118.67 46.57 122.00 44.66C125.33 42.75 131.67 39.68 134.00 38.93C136.33 38.18 134.79 38.14 136.00 40.15C137.21 42.16 140.59 48.71 141.25 51.00C141.92 53.29 141.38 52.52 140.00 53.92C138.62 55.32 134.87 57.71 133.00 59.39C131.13 61.07 129.97 62.39 128.80 64.00C127.63 65.61 126.66 67.36 126.00 69.03C125.34 70.69 124.85 72.17 124.83 74.00C124.82 75.83 124.99 77.83 125.90 80.00C126.82 82.17 129.19 84.67 130.31 87.00C131.42 89.33 132.07 91.83 132.61 94.00C133.16 96.17 133.41 98.00 133.57 100.00C133.73 102.00 133.93 103.67 133.59 106.00C133.25 108.33 133.61 108.17 131.55 114.00C129.48 119.83 123.46 135.37 121.20 141.00C118.95 146.63 119.37 145.83 118.00 147.77C116.63 149.71 115.00 151.36 113.00 152.62C111.00 153.89 108.00 154.93 106.00 155.37C104.00 155.82 102.50 155.48 101.00 155.28C99.50 155.08 98.33 154.80 97.00 154.18C95.67 153.56 98.81 157.42 93.00 151.56C87.19 145.70 67.81 125.09 62.12 119.00C56.44 112.91 59.91 116.53 58.89 115.00C57.87 113.47 56.84 111.65 56.00 109.82C55.16 107.99 54.38 106.14 53.86 104.00C53.34 101.86 52.84 99.83 52.86 97.00C52.87 94.17 53.12 90.50 53.94 87.00C54.77 83.50 56.52 79.17 57.80 76.00C59.07 72.83 59.76 71.00 61.62 68.00C63.48 65.00 67.69 60.00 68.95 58.00C70.20 56.00 69.44 58.17 69.15 56.00C68.86 53.83 67.44 47.33 67.20 45.00C66.97 42.67 66.92 42.79 67.72 42.00C68.52 41.21 70.95 40.51 72.00 40.25C73.05 39.98 73.42 40.10 74.00 40.40C74.58 40.69 74.74 40.57 75.45 42.00C76.16 43.43 77.49 47.62 78.24 49.00C79.00 50.38 78.21 50.46 80.00 50.27C81.79 50.08 87.17 48.59 89.00 47.87C90.83 47.14 90.08 48.09 91.00 45.94C91.92 43.80 93.73 37.16 94.52 35.00C95.31 32.84 95.32 33.41 95.73 33.00ZM96.27 68.00C97.69 67.52 100.94 67.12 102.00 67.12C103.06 67.12 102.57 67.52 102.65 68.00C102.72 68.48 102.72 69.40 102.45 70.00C102.17 70.60 102.24 71.38 101.00 71.58C99.76 71.77 96.26 71.45 95.00 71.18C93.74 70.92 93.45 70.00 93.45 70.00C93.45 70.00 94.84 68.48 96.27 68.00Z';
const LOGO_RAYS = 'M65.99 13.15L73.03 27.73M50.04 56.61L30.16 43.11M38.19 90.02L16.80 90.03M50.02 137.04L30.00 149.02';

export function HeartMark(props) {
  return (
    <svg viewBox="14.1 10.5 129.8 147.7" aria-hidden="true" {...props}>
      <path fill="currentColor" fillRule="evenodd" d={LOGO_BODY} />
      <path fill="none" stroke="currentColor" strokeWidth="3.33" strokeLinecap="round" d={LOGO_RAYS} />
    </svg>
  );
}

/**
 * - onAuth: ('login' | 'register') => void, for the Home page's own dialog.
 *           Elsewhere the Log in / Register buttons go to Home, which opens it.
 */
export default function NavBar({ user, hasNotifications, activePath, LinkComponent, onAuth }) {
  const L = LinkComponent;
  const auth = useAuth(); // null when the nav is rendered outside the app (no log-out button then)
  const signedIn = auth ? Boolean(auth.user) : true;
  // Staff also get the admin console.
  const isStaff = Boolean(auth?.user?.is_staff);
  const items = signedIn ? (isStaff ? [...NAV_ITEMS, { label: 'Admin', to: '/console' }] : NAV_ITEMS) : GUEST_ITEMS;
  const [scrollRef, more] = useScrollCue(activePath);
  const menu = useMobileMenu(activePath);
  const menuId = useId();
  const close = () => menu.setOpen(false);

  const authButton = (mode, label, className) =>
    onAuth ? (
      <button type="button" className={className} onClick={() => onAuth(mode)}>
        {label}
      </button>
    ) : (
      <L {...linkProps(L, '/')} {...(L === 'a' ? {} : { state: { auth: mode } })} className={className}>
        {label}
      </L>
    );

  return (
    // No entrance animation: the nav is the one thing that stays put between pages.
    <header className="pc-nav">
      <L {...linkProps(L, signedIn ? '/dashboard' : '/')} className="pc-logo">
        <HeartMark />
        Cardio Sense
      </L>

      <nav
        aria-label="Main"
        ref={scrollRef}
        className={`pc-nav-scroll${more.start ? ' has-more-start' : ''}${more.end ? ' has-more-end' : ''}`}
      >
        <ul className="pc-nav-links">
          {items.map((item) => (
            <li key={item.to}>
              <L
                {...linkProps(L, item.to)}
                className="pc-nav-link"
                aria-current={activePath === item.to ? 'page' : undefined}
                data-label={item.label}
              >
                {item.label}
              </L>
            </li>
          ))}
        </ul>
      </nav>

      <div className="pc-nav-actions">
        {!signedIn ? (
          <>
            {authButton('login', 'Log in', 'pc-nav-auth')}
            {authButton('register', 'Register', 'pc-nav-auth pc-nav-auth--solid')}
          </>
        ) : (
          <>
            <NavWeather />
            <NotificationsMenu LinkComponent={LinkComponent} fallbackDot={hasNotifications} />
            <L
              {...linkProps(L, '/profile')}
              className="pc-avatar"
              aria-label={`Profile: ${user?.name ?? 'you'}`}
              aria-current={activePath === '/profile' ? 'page' : undefined}
            >
              {/* Only a data:image URL made by the Profile page is shown as a photo. */}
              {user?.photo?.startsWith?.('data:image/jpeg;base64,') ? <img src={user.photo} alt="" /> : initials(user?.name)}
            </L>
            {auth?.user && (
              <button type="button" className="pc-icon-btn pc-nav-logout" aria-label="Log out" title="Log out" onClick={auth.logout}>
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
                </svg>
              </button>
            )}
          </>
        )}
        <button
          ref={menu.buttonRef}
          type="button"
          className="pc-icon-btn pc-menu-btn"
          aria-label="Open menu"
          aria-expanded={menu.open}
          aria-controls={menuId}
          onClick={() => menu.setOpen(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {menu.open && createPortal(
        <div id={menuId} ref={menu.panelRef} className="pc-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="pc-menu-head">
            <L {...linkProps(L, signedIn ? '/dashboard' : '/')} className="pc-logo" onClick={close}>
              <HeartMark />
              Cardio Sense
            </L>
            <button type="button" className="pc-icon-btn" aria-label="Close menu" onClick={close} data-autofocus>
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav aria-label="Main" className="pc-menu-nav">
            <ul>
              {[...items, ...(signedIn ? [{ label: 'Guidance', to: '/guidance' }, { label: 'Profile', to: '/profile' }] : [])].map(
                (item, i) => (
                  <li key={item.to} style={{ '--i': i }}>
                    <L
                      {...linkProps(L, item.to)}
                      className="pc-menu-link"
                      aria-current={activePath === item.to ? 'page' : undefined}
                      onClick={close}
                    >
                      {item.label}
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </L>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="pc-menu-foot">
            {!signedIn ? (
              <div className="pc-menu-auth">
                {onAuth ? (
                  <>
                    <button type="button" className="pc-nav-auth" onClick={() => { close(); onAuth('login'); }}>Log in</button>
                    <button type="button" className="pc-nav-auth pc-nav-auth--solid" onClick={() => { close(); onAuth('register'); }}>Register</button>
                  </>
                ) : (
                  <>
                    <L {...linkProps(L, '/')} {...(L === 'a' ? {} : { state: { auth: 'login' } })} className="pc-nav-auth" onClick={close}>Log in</L>
                    <L {...linkProps(L, '/')} {...(L === 'a' ? {} : { state: { auth: 'register' } })} className="pc-nav-auth pc-nav-auth--solid" onClick={close}>Register</L>
                  </>
                )}
              </div>
            ) : (
              <>
                <NavWeather />
                {auth?.user && (
                  <button type="button" className="pc-menu-logout" onClick={() => { close(); auth.logout(); }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
                    </svg>
                    Log out
                  </button>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
