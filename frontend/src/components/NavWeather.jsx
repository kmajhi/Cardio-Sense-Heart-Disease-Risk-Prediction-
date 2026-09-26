import { useEffect, useState } from 'react';
import { cachedWeather, describeWeather, loadWeather, placeFrom } from './weather';
import { useNotifications } from '../notifications/NotificationsContext';
import './NavWeather.css';

const ICONS = {
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  'cloud-sun': 'M8 3v1.5M3.5 8H2M4.8 4.8l1 1M13 7a4 4 0 0 0-7.4 1.7M7 20h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 20Z',
  'cloud-moon': 'M11 6.5A4.5 4.5 0 0 0 5 5a4.5 4.5 0 0 0 4 6M7 20h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 20Z',
  cloud: 'M7 19h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 19Z',
  fog: 'M4 9h16M3 13h18M5 17h14',
  rain: 'M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15ZM8 18l-1 2M12 18l-1 2M16 18l-1 2',
  snow: 'M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15ZM8 19h.01M12 20h.01M16 19h.01',
  storm: 'M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15ZM12 15l-2 4h4l-2 3',
};

// Day and date in the place's own time zone; "26 Sep" (en-GB would give "26 Sept").
function dayAndDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'short', timeZone })
    .formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type).value;
  return [part('weekday'), `${part('day')} ${part('month')}`];
}

/** Re-renders every minute, so the day name changes at the city's midnight. */
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Day name and current weather for the profile's city (Dhaka if none is set),
 * beside the nav's notification bell. Starts from the shared cache, so it looks
 * identical on every page; its width is fixed, so loading or a changing
 * temperature never nudges the nav.
 */
export default function NavWeather() {
  const now = useMinute();
  const place = placeFrom(useNotifications()?.profile);
  const placeKey = `${place.latitude},${place.longitude},${place.timeZone}`;
  const [weather, setWeather] = useState(() => cachedWeather(place));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setWeather(cachedWeather(place)); // a new city never shows the old city's reading
    const refresh = () =>
      loadWeather(place)
        .then((w) => alive && (setWeather(w), setFailed(false)))
        .catch(() => alive && setFailed(true));
    refresh();
    const id = setInterval(refresh, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // placeKey stands in for `place`, a new object on every render.
  }, [placeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [day, date] = dayAndDate(now, place.timeZone);
  const sky = weather ? describeWeather(weather.code, weather.isDay) : null;
  const temp = weather ? `${weather.temp}°C` : '--°C';
  const label = weather
    ? `${day}, ${date}. ${place.name}: ${weather.temp} degrees Celsius, ${sky.label.toLowerCase()}.`
    : `${day}, ${date}. ${place.name}: ${failed ? 'weather unavailable' : 'loading weather'}.`;

  return (
    <div className="pc-weather" role="group" aria-label={label} title={sky ? `${sky.label} in ${place.name}` : undefined}>
      <span className="pc-weather-day" aria-hidden="true">
        <b>
          <span className="pc-weather-long">{day}</span>
          <span className="pc-weather-short">{day.slice(0, 3)}</span>
        </b>
        <small>{date}</small>
      </span>
      <span className="pc-weather-sep" aria-hidden="true" />
      <span className="pc-weather-now" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={sky ? `is-${sky.icon}` : 'is-idle'}>
          <path d={ICONS[sky?.icon ?? 'cloud']} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="pc-weather-text">
          <b>{temp}</b>
          <small>{place.name}</small>
        </span>
      </span>
    </div>
  );
}
