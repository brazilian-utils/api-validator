import en from '../content/i18n/en.json';
import pt from '../content/i18n/pt-br.json';

export type Locale = 'en' | 'pt-BR';
export const LOCALES: Locale[] = ['en', 'pt-BR'];
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', 'pt-BR': 'Português' };

/** URL prefix of a language, without the base path ('' for English, the root locale). */
export const prefixOf = (locale: Locale) => (locale === 'en' ? '' : '/pt-br');

const STRINGS: Record<Locale, Record<string, string>> = { en, 'pt-BR': pt };

/** i18next-style lookup: {{name}} values, `_one`/`_other` plurals by `count`. */
export function translator(locale: Locale) {
  return (key: string, values: Record<string, unknown> = {}) => {
    const table = STRINGS[locale];
    const plural = typeof values.count === 'number' ? `${key}_${values.count === 1 ? 'one' : 'other'}` : undefined;
    const raw = (plural && (table[plural] ?? STRINGS.en[plural])) ?? table[key] ?? STRINGS.en[key] ?? key;
    return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => String(values[name] ?? ''));
  };
}

/** Text in the page's language from a contract value `{ en, pt-BR? }`, falling back to English. */
export const pick = (v: Record<string, string | undefined> | undefined, locale: Locale) => v?.[locale] ?? v?.en ?? '';
