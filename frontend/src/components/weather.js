// Current weather for the nav, from Open-Meteo (free, no API key; only the
// place's coordinates are sent). The place is the profile's city, or Dhaka if
// none is set. Cached per place in memory and sessionStorage for 15 minutes,
// so moving between pages shows the same values instantly instead of
// re-fetching and flickering.

export const DEFAULT_PLACE = { name: 'Dhaka', latitude: 23.7104, longitude: 90.4074, timeZone: 'Asia/Dhaka' };

/** The profile's picked city as a place, or the default. */
export function placeFrom(profile) {
  const lat = Number(profile?.latitude);
  const lon = Number(profile?.longitude);
  const name = profile?.city || profile?.country;
  const located = name && profile.timezone && profile.latitude !== '' && profile.longitude !== '';
  if (!located || !Number.isFinite(lat) || !Number.isFinite(lon)) return DEFAULT_PLACE;
  return { name, latitude: lat, longitude: lon, timeZone: profile.timezone };
}

const TTL_MS = 15 * 60 * 1000;
const KEY = 'cardio-sense:weather';

const keyOf = (place) => `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
const urlOf = (place) =>
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${place.latitude}&longitude=${place.longitude}` +
  `&current=temperature_2m,weather_code,is_day&timezone=${encodeURIComponent(place.timeZone)}`;

const memory = new Map(); // place key -> { at, data }
const inflight = new Map(); // place key -> Promise

function stored() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

const fresh = (entry) => entry && Date.now() - entry.at < TTL_MS;

/** The cached reading for a place, if still fresh: lets the nav render its final state on the first frame. */
export function cachedWeather(place = DEFAULT_PLACE) {
  const key = keyOf(place);
  if (fresh(memory.get(key))) return memory.get(key).data;
  const s = stored()[key];
  if (fresh(s)) {
    memory.set(key, s);
    return s.data;
  }
  return null;
}

/** { temp, code, isDay } for a place: one request per place at a time, however many navs ask. */
export function loadWeather(place = DEFAULT_PLACE) {
  const hit = cachedWeather(place);
  if (hit) return Promise.resolve(hit);
  const key = keyOf(place);
  if (inflight.has(key)) return inflight.get(key);
  const request = fetch(urlOf(place))
    .then((res) => {
      if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
      return res.json();
    })
    .then(({ current }) => {
      const data = { temp: Math.round(current.temperature_2m), code: current.weather_code, isDay: current.is_day === 1 };
      const entry = { at: Date.now(), data };
      memory.set(key, entry);
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ ...stored(), [key]: entry }));
      } catch {
        /* memory cache still works */
      }
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

/** WMO weather code → a short label and an icon name (see NavWeather.jsx). */
export function describeWeather(code, isDay) {
  if (code === 0) return { label: 'Clear', icon: isDay ? 'sun' : 'moon' };
  if (code <= 2) return { label: 'Partly cloudy', icon: isDay ? 'cloud-sun' : 'cloud-moon' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
  if (code >= 51 && code <= 67) return { label: code <= 57 ? 'Drizzle' : 'Rain', icon: 'rain' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'rain' };
  if (code >= 95) return { label: 'Thunderstorm', icon: 'storm' };
  return { label: 'Weather', icon: 'cloud' };
}
