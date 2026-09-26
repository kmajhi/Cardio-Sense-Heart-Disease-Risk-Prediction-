import { useEffect, useState } from 'react';
import { fullTime, refreshDelay, timeAgo } from './time';

/**
 * "5 sec ago", kept current while it's on screen: it re-renders every second
 * for the first minute, then every 30 seconds. Hover shows the exact time.
 */
export default function RelativeTime({ iso, className = 'pc-n-time' }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!iso) return undefined;
    const id = setTimeout(() => setNow(Date.now()), refreshDelay(iso, now));
    return () => clearTimeout(id);
  }, [iso, now]);

  if (!iso) return null;
  return (
    <time className={className} dateTime={iso} title={fullTime(iso)}>
      {timeAgo(iso, now)}
    </time>
  );
}
