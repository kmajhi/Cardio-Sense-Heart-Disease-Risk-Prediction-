// Place search for the profile's location: Open-Meteo's geocoding API (free,
// no key; only the typed place or country name is sent). Every result carries
// its IANA time zone and coordinates, so a pick resolves the location exactly.
const URL = 'https://geocoding-api.open-meteo.com/v1/search';

const round4 = (n) => Math.round(n * 10000) / 10000;

async function search(name, { countryCode, count = 6, signal } = {}) {
  const params = new URLSearchParams({ name, count: String(count), language: 'en', format: 'json' });
  if (countryCode) params.set('countryCode', countryCode);
  const res = await fetch(`${URL}?${params}`, { signal });
  if (!res.ok) throw new Error('Place search is unavailable right now.');
  const { results = [] } = await res.json();
  return results.filter((r) => r.timezone && Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
}

/**
 * Places matching `query`, optionally only in one country →
 * [{ id, city, state, country, country_code, timezone, latitude, longitude }].
 */
export async function searchCities(query, { countryCode, signal } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];
  const results = await search(q, { countryCode, signal });
  return results
    .filter((r) => !r.feature_code?.startsWith('PCL')) // the country itself isn't a city
    .map((r) => ({
      id: r.id,
      city: r.name,
      state: r.admin1 ?? '',
      country: r.country ?? '',
      country_code: (r.country_code ?? '').toUpperCase(),
      timezone: r.timezone,
      latitude: round4(r.latitude),
      longitude: round4(r.longitude),
    }));
}

const countryCache = new Map();

/**
 * A country's own time zone and centre → { timezone, latitude, longitude }.
 * Used when only a country is chosen, or a typed city isn't in the search.
 * For countries spanning several time zones this is the main one.
 */
export function resolveCountry(code, name) {
  const key = code.toUpperCase();
  if (!countryCache.has(key)) {
    const request = search(name, { countryCode: key, count: 10 })
      .then((results) => {
        const hit = results.find((r) => r.feature_code?.startsWith('PCL')) ?? results[0];
        if (!hit) throw new Error(`Couldn't find a time zone for ${name}.`);
        return { timezone: hit.timezone, latitude: round4(hit.latitude), longitude: round4(hit.longitude) };
      })
      .catch((err) => {
        countryCache.delete(key); // let a later attempt retry
        throw err;
      });
    countryCache.set(key, request);
  }
  return countryCache.get(key);
}

/** "GMT+6" for a time zone, now. */
export function utcOffset(timeZone, date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName').value;
  } catch {
    return '';
  }
}
