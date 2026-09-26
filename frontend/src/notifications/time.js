// Relative times for notifications and "updated …" labels.

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fullFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** "just now", "1 sec ago", "30 sec ago", "5 min ago", "3 h ago", "2 days ago", or "on 4 Sep 2026". */
export function timeAgo(iso, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const seconds = Math.max(0, Math.floor(ms / 1000)); // a clock slightly ahead never shows "in 2 sec"
  if (seconds < 1) return 'just now';
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return `on ${dateFmt.format(new Date(iso))}`;
}

/** The exact time, for a tooltip. */
export const fullTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fullFmt.format(d);
};

/** How long until the label can change: every second for the first minute, then every 30 s. */
export function refreshDelay(iso, now = Date.now()) {
  return now - new Date(iso).getTime() < 60_000 ? 1000 : 30_000;
}
