import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { linkProps } from '../../../components/link';
import './PlanToast.css';

const WIDE = '(min-width: 1001px)';

/**
 * "Your plan is ready": a notification that slides in beside the result card's
 * Run button once an assessment is saved, pointing to the personalised diet and
 * workout plan (/guidance). Rendered in a portal so it can float next to the
 * card (whose backdrop blur would otherwise trap a fixed child). On narrow
 * screens it's a toast at the bottom. If anything is urgent it says to see a
 * doctor first, so the plan never upstages a medical warning.
 */
export default function PlanToast({ notification, LinkComponent = 'a', onClose }) {
  const [pos, setPos] = useState(null);
  const L = LinkComponent;
  const urgent = notification?.urgent?.length > 0;

  // Sit level with the Run button, just left of the result card; follow it as the
  // page scrolls or resizes (the card is sticky, so this settles quickly).
  useLayoutEffect(() => {
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const card = document.querySelector('.pc-pr-result');
        const run = card?.querySelector('.pc-pr-run');
        if (!card || !run || !window.matchMedia(WIDE).matches) {
          setPos(null);
          return;
        }
        const c = card.getBoundingClientRect();
        const r = run.getBoundingClientRect();
        // Bottom edge level with the Run button's, never below the screen's edge.
        setPos({
          right: Math.round(window.innerWidth - c.left + 16),
          bottom: Math.round(Math.max(16, window.innerHeight - r.bottom)),
        });
      });
    };
    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, []);

  // Escape dismisses it, like any notification.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!notification) return null;

  return createPortal(
    <aside
      className={`pc-plan-toast${pos ? ' is-beside' : ''}${urgent ? ' is-urgent' : ''}`}
      style={pos ? { right: pos.right, bottom: pos.bottom } : undefined}
      role="status"
      aria-live="polite"
      aria-label="Your personalised plan is ready"
    >
      {/* The bell tile: a soft raised square, a bell and an unread badge. */}
      <span className="pc-plan-bell" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 3a1.4 1.4 0 0 1 1.4 1.3A6 6 0 0 1 18 10.2V14l1.6 2.6a.9.9 0 0 1-.8 1.4H5.2a.9.9 0 0 1-.8-1.4L6 14v-3.8a6 6 0 0 1 4.6-5.9A1.4 1.4 0 0 1 12 3Z" />
          <path d="M9.6 19.2a2.4 2.4 0 0 0 4.8 0Z" />
        </svg>
        <b>1</b>
      </span>

      <div className="pc-plan-body">
        <p className="pc-plan-kicker">New · just now</p>
        <p className="pc-plan-title">Your plan is ready</p>
        <p className="pc-plan-text">
          {urgent
            ? 'Some values need prompt medical attention: see a doctor first. Your plan explains what to do meanwhile.'
            : 'Diet, workout and daily habits, personalised from this assessment.'}
        </p>
        <L {...linkProps(L, '/guidance')} className="pc-plan-btn" onClick={onClose}>
          See Personalized Diet &amp; Workout Plan <span aria-hidden="true">→</span>
        </L>
      </div>

      <button type="button" className="pc-plan-close" aria-label="Dismiss" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </aside>,
    document.body,
  );
}
