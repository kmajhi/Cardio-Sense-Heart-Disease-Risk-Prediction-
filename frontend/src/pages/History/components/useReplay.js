import { useRef, useState } from 'react';

/**
 * Replays a card's illustration when it's hovered or focused, like the
 * reference's feature cards. Put `key={replay}` on the animated element:
 * the new key remounts it, which restarts its CSS animation.
 * Throttled so moving the pointer across a card doesn't stutter it.
 */
export default function useReplay(cooldownMs = 1600) {
  const [replay, setReplay] = useState(0);
  const last = useRef(0);

  const trigger = () => {
    const now = Date.now();
    if (now - last.current < cooldownMs) return;
    last.current = now;
    setReplay((n) => n + 1);
  };

  return [replay, { onMouseEnter: trigger, onFocus: trigger }];
}
