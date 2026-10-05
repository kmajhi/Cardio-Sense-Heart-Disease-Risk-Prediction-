import { useId } from 'react';
import './RolePicker.css';

const ROLES = [
  { id: 'patient', label: 'User / Patient', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' },
  { id: 'admin', label: 'Admin', icon: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM9 12l2 2 4-4' },
  { id: 'doctor', label: 'Doctor', icon: 'M6 3v6a5 5 0 0 0 10 0V3M11 14v2a5 5 0 0 0 10 0v-2M21 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
];

/**
 * "Choose your role" on the sign-in screens (the home login window and the
 * Doctor Portal). It only chooses which sign-in to show; what an account may
 * do is decided by the server.
 *
 * Arrow keys move between roles, like any radio group.
 */
export default function RolePicker({ role, onRole }) {
  const labelId = useId();
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = ROLES.findIndex((r) => r.id === role);
    const next = ROLES[(i + step + ROLES.length) % ROLES.length];
    onRole(next.id);
    requestAnimationFrame(() => e.currentTarget?.querySelector?.(`[data-role="${next.id}"]`)?.focus());
  };
  return (
    <div className="rp-roles">
      <p className="rp-label" id={labelId}>
        Choose your role
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="rp-row" onKeyDown={onKey}>
        {ROLES.map((r) => {
          const on = role === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              data-role={r.id}
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              className={`rp-role${on ? ' is-on' : ''}`}
              onClick={() => onRole(r.id)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d={r.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
