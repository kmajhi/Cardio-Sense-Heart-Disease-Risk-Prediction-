import { useEffect, useState } from 'react';
import './ThemeSwitch.css';

const MOON = 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z';
const SUN_CORE = 'M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z';
const SUN_RAYS = 'M12 1.8v2.4M12 19.8v2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7';

/**
 * Light / dark switch with a glass-bubble knob (admin console and Doctor Panel).
 *
 * The knob shows the current mode (moon = dark, sun = light) and the text names
 * the mode a click switches to, as in the design. It is a real switch for
 * assistive tech: role="switch", aria-checked = dark mode is on.
 */
export default function ThemeSwitch({ dark, onToggle, className = '' }) {
  // No slide or squash on first paint, only when the mode changes.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`ts-switch ${dark ? 'is-dark' : 'is-light'}${ready ? ' is-ready' : ''} ${className}`}
      onClick={onToggle}
    >
      <span className="ts-track" aria-hidden="true">
        <span className="ts-label ts-label-dark">Dark</span>
        <span className="ts-label ts-label-light">Light</span>
      </span>
      <span className="ts-knob" aria-hidden="true">
        <span className="ts-core">
          <svg className="ts-icon ts-moon" viewBox="0 0 24 24">
            <path d={MOON} fill="currentColor" />
          </svg>
          <svg className="ts-icon ts-sun" viewBox="0 0 24 24">
            <path d={SUN_CORE} fill="currentColor" />
            <path d={SUN_RAYS} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </span>
    </button>
  );
}
