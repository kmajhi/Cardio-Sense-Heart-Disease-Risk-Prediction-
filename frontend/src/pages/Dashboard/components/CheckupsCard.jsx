import { useMemo, useState } from 'react';

const FILTERS = ['All', 'Today', 'Tomorrow', 'Week', 'Month'];
const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function inRange(appointment, filter, now) {
  const start = new Date(appointment.start);
  const dayDiff = Math.round((startOfDay(start) - startOfDay(now)) / DAY);
  switch (filter) {
    case 'Today':
      return dayDiff === 0;
    case 'Tomorrow':
      return dayDiff === 1;
    case 'Week':
      return dayDiff >= 0 && dayDiff < 7;
    case 'Month':
      return dayDiff >= 0 && dayDiff < 31;
    default:
      return true;
  }
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const initials = (name) =>
  name
    .replace(/^Dr\.?\s*/i, '')
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export default function CheckupsCard({ appointments = [] }) {
  const [filter, setFilter] = useState('All');
  const now = useMemo(() => new Date(), []);

  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.start).getTime() >= now.getTime() - 60 * 60 * 1000)
        .sort((a, b) => new Date(a.start) - new Date(b.start)),
    [appointments, now],
  );
  const next = upcoming.find((a) => inRange(a, filter, now));

  const dayLabel = (a) => {
    const d = new Date(a.start);
    const diff = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return dayFmt.format(d);
  };

  return (
    <article className="pc-checkups pc-enter" style={{ '--d': '360ms', '--pc-rise': '60px' }}>
      <div className="pc-checkups-head">
        <h2 className="pc-checkups-title">Upcoming check-ups</h2>
        <span className="pc-count">{upcoming.length} booked</span>
      </div>

      {next ? (
        // Keyed so a filter change remounts it and replays the glide-in.
        <div className="pc-appt" key={`${filter}-${next.id}`}>
          <div>
            <p className="pc-appt-specialty">{next.specialty}</p>
            <p className="pc-appt-doctor">{next.doctor}</p>
            <p className="pc-appt-when">
              <span className="pc-appt-time">{timeFmt.format(new Date(next.start))}</span>
              <span className="pc-pill-soft">{next.minutes} min</span>
            </p>
            <p className="pc-appt-day">{dayLabel(next)}</p>
          </div>
          <span className="pc-appt-avatar" aria-hidden="true">
            {initials(next.doctor)}
          </span>
        </div>
      ) : (
        <p className="pc-appt-empty" key={filter}>
          No check-ups booked for this period.
        </p>
      )}

      <div className="pc-filters" role="group" aria-label="Show check-ups for">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className="pc-filter"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
    </article>
  );
}
