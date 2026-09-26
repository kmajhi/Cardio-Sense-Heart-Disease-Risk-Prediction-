// Every country for the Country picker: ISO 3166-1 alpha-2 codes, named by
// the browser's own Intl.DisplayNames (so no name list to maintain).

const CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO ' +
  'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR ' +
  'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO ' +
  'RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV ' +
  'TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

const names = new Intl.DisplayNames(['en'], { type: 'region' });

/** "🇧🇩" from "BD" (regional-indicator letters). */
export const flag = (code) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** [{ code, name, flag }], alphabetical by name. */
export const COUNTRIES = CODES.map((code) => ({ code, name: names.of(code) ?? code, flag: flag(code) })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const countryByCode = (code) => COUNTRIES.find((c) => c.code === (code ?? '').toUpperCase()) ?? null;

// Accent- and case-insensitive: "cote" finds "Côte d’Ivoire".
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Countries whose name (or code) matches the query: names starting with it first. */
export function searchCountries(query) {
  const q = fold(query.trim());
  if (!q) return COUNTRIES;
  const starts = [];
  const contains = [];
  for (const c of COUNTRIES) {
    const n = fold(c.name);
    if (n.startsWith(q) || c.code.toLowerCase() === q) starts.push(c);
    else if (n.includes(q)) contains.push(c);
  }
  return [...starts, ...contains];
}
