import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/min';

/** A country of residence as booking step 1 lists it. */
export type Country = { code: CountryCode; name: string; dial: string; flag: string };

/** 🇨🇲 from `CM`: the two regional-indicator letters. */
const flagOf = (code: string): string => String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));

/**
 * Every country, named in `locale` and sorted that way, with its dialling code.
 * Open to all countries: how one pays depends on the country, later, from SasPay.
 */
export function countries(locale: string): Country[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return getCountries()
    .map((code) => ({ code, name: names.of(code) ?? code, dial: `+${getCountryCallingCode(code)}`, flag: flagOf(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
