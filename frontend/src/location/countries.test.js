import { describe, expect, it } from 'vitest';
import { COUNTRIES, countryByCode, flag, searchCountries } from './countries';

describe('countries', () => {
  it('lists every ISO country once, named and sorted', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(245);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(countryByCode('bd')).toMatchObject({ code: 'BD', name: 'Bangladesh', flag: '🇧🇩' });
    const names = COUNTRIES.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('searches by name start, then anywhere, ignoring case and accents', () => {
    expect(searchCountries('bang')[0].code).toBe('BD');
    expect(searchCountries('united').map((c) => c.code)).toEqual(expect.arrayContaining(['AE', 'GB', 'US']));
    expect(searchCountries('cote')[0].code).toBe('CI');
    expect(searchCountries('us')[0].code).toBe('US'); // exact code match
    expect(searchCountries('zzzz')).toEqual([]);
  });

  it('builds flags from codes', () => {
    expect(flag('JP')).toBe('🇯🇵');
  });
});
