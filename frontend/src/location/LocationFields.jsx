import { useEffect, useMemo, useRef, useState } from 'react';
import Combobox from './Combobox';
import { countryByCode, searchCountries } from './countries';
import { resolveCountry, searchCities, utcOffset } from '../api/geocodeApi';

export const LOCATION_KEYS = ['country', 'country_code', 'state', 'city', 'timezone', 'latitude', 'longitude'];

const cleared = { city: '', state: '', timezone: '', latitude: '', longitude: '' };
const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Country → State / province → City.
 *
 * - Country: searchable list of every country; picking one also looks up the
 *   country's own time zone, so a country alone is enough for the date.
 * - City: type to search places in that country (each shows its state); picking
 *   one sets the exact time zone and coordinates and fills the state. A city
 *   that isn't found can still be kept as typed, with the country's time zone.
 * - State / province: filled from the picked city, or typed.
 *
 * value: the draft (profile fields); update(patch | draft => patch).
 */
export default function LocationFields({ value, update, errors = {}, idPrefix = 'pf' }) {
  const [countryText, setCountryText] = useState(null); // null: show the picked country
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState(null); // null: nothing typed since the last pick
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [countryInfo, setCountryInfo] = useState(null); // { code, timezone, latitude, longitude }
  const [countryStatus, setCountryStatus] = useState('idle'); // idle | loading | error
  const code = value.country_code;
  const codeRef = useRef(code);
  codeRef.current = code;

  // The picked country's own time zone and centre (used for typed cities).
  useEffect(() => {
    if (!code) {
      setCountryInfo(null);
      return;
    }
    if (countryInfo?.code === code) return;
    setCountryStatus('loading');
    resolveCountry(code, countryByCode(code)?.name ?? value.country)
      .then((info) => {
        if (codeRef.current !== code) return;
        setCountryInfo({ code, ...info });
        setCountryStatus('idle');
        // A country with no city yet: the country's time zone applies.
        update((d) => (d.country_code === code && !d.timezone ? info : {}));
      })
      .catch(() => codeRef.current === code && setCountryStatus('error'));
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // City search, limited to the chosen country (debounced).
  useEffect(() => {
    if (cityQuery === null || cityQuery.trim().length < 2 || !code) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      setStatus('loading');
      searchCities(cityQuery, { countryCode: code, signal: ctrl.signal })
        .then((found) => {
          setResults(found);
          setStatus('idle');
        })
        .catch((err) => err.name !== 'AbortError' && setStatus('error'));
    }, 300);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [cityQuery, code]);

  // ---------- Country ----------

  const countryOptions = useMemo(
    () =>
      searchCountries(countryText ?? '').map((c) => ({ key: c.code, label: c.name, detail: c.code, lead: c.flag, country: c })),
    [countryText],
  );

  const pickCountry = ({ country }) => {
    setCountryText(null);
    setCountryOpen(false);
    if (country.code === code) return;
    setCityQuery(null);
    setResults([]);
    update({ country: country.name, country_code: country.code, ...cleared });
  };

  const clearCountry = () => {
    setCountryText('');
    setCityQuery(null);
    update({ country: '', country_code: '', ...cleared });
  };

  // ---------- City ----------

  const typeCity = (text) => {
    setCityQuery(text);
    // No longer a picked place: fall back to the country's time zone until one is picked.
    update({
      city: text,
      timezone: countryInfo?.timezone ?? '',
      latitude: countryInfo?.latitude ?? '',
      longitude: countryInfo?.longitude ?? '',
    });
  };

  const pickCity = (o) => {
    setCityQuery(null);
    setCityOpen(false);
    setResults([]);
    if (o.typed) {
      update({ city: o.typed, timezone: countryInfo.timezone, latitude: countryInfo.latitude, longitude: countryInfo.longitude });
      return;
    }
    const p = o.place;
    update({ city: p.city, state: p.state, timezone: p.timezone, latitude: p.latitude, longitude: p.longitude });
  };

  const clearCity = () => {
    setCityQuery(null);
    update({
      city: '',
      timezone: countryInfo?.timezone ?? '',
      latitude: countryInfo?.latitude ?? '',
      longitude: countryInfo?.longitude ?? '',
    });
  };

  const typed = (cityQuery ?? '').trim();
  const cityOptions = [
    ...results.map((r) => ({
      key: r.id,
      label: r.city,
      detail: r.state,
      note: `${r.timezone} · ${utcOffset(r.timezone)}`,
      place: r,
    })),
    // Not in the search (or a small place): keep it as typed, with the country's time zone.
    ...(typed.length >= 2 && countryInfo && status !== 'loading' && !results.some((r) => sameText(r.city, typed))
      ? [{
        key: '__typed',
        label: `Use “${typed}”`,
        detail: `in ${value.country}`,
        note: `${countryInfo.timezone} · ${utcOffset(countryInfo.timezone)} (the country’s time zone)`,
        typed,
      }]
      : []),
  ];
  const cityMessage =
    cityQuery === null || typed.length < 2
      ? ''
      : status === 'loading'
        ? 'Searching…'
        : status === 'error'
          ? 'Place search is unavailable right now.'
          : results.length
            ? ''
            : `No match in ${value.country}.`;

  const countryHint = !code
    ? 'Search and pick your country from the list.'
    : countryStatus === 'loading'
      ? 'Looking up the time zone…'
      : countryStatus === 'error'
        ? 'Couldn’t look up this country’s time zone. Check your connection and pick it again.'
        : '';
  const tzHint = value.timezone
    ? `Time zone ${value.timezone} (${utcOffset(value.timezone)}), used for your date and local weather.`
    : '';

  return (
    <div className="pc-p-location">
      <Combobox
        id={`${idPrefix}-country`}
        label="Country"
        text={countryText ?? (code ? `${countryByCode(code)?.flag ?? ''} ${value.country}`.trim() : value.country)}
        onType={setCountryText}
        options={countryOptions}
        onPick={pickCountry}
        onClear={clearCountry}
        open={countryOpen}
        setOpen={(o) => {
          setCountryOpen(o);
          if (o && countryText === null) setCountryText(''); // start from the full list
          if (!o) setCountryText(null);
        }}
        message={countryOptions.length ? '' : 'No country matches that.'}
        placeholder="Search country, e.g. Bangladesh"
        hint={countryHint || (!value.city ? tzHint : '')}
        error={errors.country}
      />
      <div className="pc-p-field">
        <label htmlFor={`${idPrefix}-state`} className="pc-p-label">
          State / province <span className="pc-p-muted">(optional)</span>
        </label>
        <input
          id={`${idPrefix}-state`}
          className="pc-p-input"
          value={value.state}
          maxLength={80}
          placeholder={code ? 'Filled from your city, or type it' : 'Choose a country first'}
          disabled={!code}
          onChange={(e) => update({ state: e.target.value })}
        />
      </div>
      <Combobox
        id={`${idPrefix}-city`}
        label="City"
        text={value.city}
        onType={typeCity}
        options={cityOptions}
        onPick={pickCity}
        onClear={clearCity}
        open={cityOpen}
        setOpen={setCityOpen}
        message={cityMessage}
        placeholder={code ? `Search a city in ${value.country}` : 'Choose a country first'}
        disabled={!code}
        hint={value.city ? tzHint : code ? 'Type to search, then pick your city (its state fills in).' : ''}
        error={errors.city}
      />
    </div>
  );
}
