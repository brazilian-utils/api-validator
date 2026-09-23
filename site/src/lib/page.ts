// What every component needs about the page it renders in: its language and URL prefixes.
import { LANG_PREFIX } from './registry.mjs';

/** The site's base path without the trailing slash ('' at a domain root). */
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export type Locale = 'en' | 'pt-BR';

/** `locale` of the page, and `prefix` = base + language folder, for links to other pages. */
export function pageContext(astro: { locals: { starlightRoute: { lang: string } } }) {
  const locale: Locale = astro.locals.starlightRoute.lang === 'pt-BR' ? 'pt-BR' : 'en';
  const folder = (LANG_PREFIX as Record<string, string>)[locale];
  return { locale, prefix: folder ? `${BASE}/${folder}` : BASE };
}

/**
 * Options for t() calls that insert values: i18next escapes them for HTML, but Astro escapes what
 * it renders already, so the text would show `&#x2F;` for `/`. Starlight does the same.
 */
export const RAW = { interpolation: { escapeValue: false } } as const;
