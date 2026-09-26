import { describe, expect, it } from 'vitest';
import { DEFAULT_PLACE, describeWeather, placeFrom } from './weather';
import { EMPTY_PROFILE, validate } from '../pages/Profile/profileFields';

describe('placeFrom', () => {
  it('uses the profile’s picked city', () => {
    const profile = { city: 'Chattogram', timezone: 'Asia/Dhaka', latitude: 22.3384, longitude: 91.8317 };
    expect(placeFrom(profile)).toEqual({ name: 'Chattogram', latitude: 22.3384, longitude: 91.8317, timeZone: 'Asia/Dhaka' });
  });

  it('falls back to Dhaka without a profile, or with a typed-but-unpicked city', () => {
    expect(placeFrom(null)).toBe(DEFAULT_PLACE);
    expect(placeFrom({ ...EMPTY_PROFILE, city: 'Paris' })).toBe(DEFAULT_PLACE);
  });
});

describe('profile location validation', () => {
  const base = { ...EMPTY_PROFILE, full_name: 'A' };
  it('needs a country from the list, with its time zone', () => {
    expect(validate({ ...base, city: 'Paris' }).country).toMatch(/Pick your country/);
    expect(validate({ ...base, country: 'France', country_code: 'FR' }).country).toMatch(/time zone/);
    expect(validate({ ...base, country: 'France', country_code: 'FR', timezone: 'Europe/Paris' }).country).toBeUndefined();
    expect(validate(base).country).toBeUndefined(); // location is optional
  });

  it('a country alone is enough for the date and weather', () => {
    const p = { ...base, country: 'Bangladesh', country_code: 'BD', timezone: 'Asia/Dhaka', latitude: 24, longitude: 90 };
    expect(placeFrom(p)).toEqual({ name: 'Bangladesh', latitude: 24, longitude: 90, timeZone: 'Asia/Dhaka' });
  });
});

describe('describeWeather', () => {
  it('maps WMO codes, with day and night icons', () => {
    expect(describeWeather(0, true).icon).toBe('sun');
    expect(describeWeather(0, false).icon).toBe('moon');
    expect(describeWeather(63, true).label).toBe('Rain');
    expect(describeWeather(95, true).label).toBe('Thunderstorm');
  });
});
