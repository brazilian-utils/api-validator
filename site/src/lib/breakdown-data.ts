// What each coverage summary of a page opens (breakdown.client.tsx): the list behind "3 missing",
// with its heading and its link. Written at build time as one JSON per page (api/breakdown/…) and
// fetched the first time a summary is hovered or tapped, so a page with three hundred summaries
// (the parity matrix) carries none of their lists, only the words.
import { type BreakdownItem, functionBreakdown, libraryBreakdown } from '@/lib/breakdown';
import { loadLibs, loadSpecs } from '@/lib/data';
import { LOCALES, type Locale, pick, prefixOf, translator } from '@/lib/i18n';

export interface BreakdownDetail {
  /** Heading of the list: what the breakdown is about. */
  title: string;
  items: BreakdownItem[];
  href?: string;
  hrefText?: string;
}

export const localeSlug = (locale: Locale) => (locale === 'en' ? 'en' : 'pt-br');
export const localeOf = (slug: string): Locale | undefined => LOCALES.find((l) => localeSlug(l) === slug);

/** The pages that have summaries: "home", "parity", and one per utility ("util.cpf"). */
export const breakdownPages = (): string[] => ['home', 'parity', ...loadSpecs().map((s: any) => `util.${s.id}`)];

/** The file a page's summaries fetch, relative to the base path. */
export const breakdownUrl = (base: string, page: string, locale: Locale) => `${base}/api/breakdown/${page}.${localeSlug(locale)}.json`;

/** Every summary of a page, by the key its button carries (data-breakdown), or null for no such page. */
export function breakdownDetails(page: string, locale: Locale): Record<string, BreakdownDetail> | null {
  const t = translator(locale);
  const p = prefixOf(locale);
  const specs = loadSpecs();
  const libs = loadLibs();
  const details: Record<string, BreakdownDetail> = {};
  if (page === 'home') {
    for (const spec of specs) {
      const util = pick(spec.title, locale);
      details[spec.id] = { title: t('cov.inLibs', { util }), items: libraryBreakdown(spec, locale).items, href: `${p}/utils/${spec.id}/`, hrefText: t('cov.openUtil', { util }) };
    }
    return details;
  }
  if (page === 'parity') {
    for (const spec of specs) {
      const util = pick(spec.title, locale);
      for (const lib of libs) {
        details[`${spec.id}/${lib.id}`] = {
          title: t('cov.inLib', { util, lib: lib.label }),
          items: functionBreakdown(spec, lib.id, locale, { names: false }).items,
          href: `${p}/utils/${spec.id}/`,
          hrefText: t('cov.openUtil', { util }),
        };
      }
    }
    return details;
  }
  if (page.startsWith('util.')) {
    const spec = specs.find((s: any) => s.id === page.slice('util.'.length));
    if (!spec) return null;
    const util = pick(spec.title, locale);
    for (const lib of libs) {
      details[lib.id] = { title: t('cov.inLib', { util, lib: lib.label }), items: functionBreakdown(spec, lib.id, locale).items, href: `${p}/libs/${lib.id}/`, hrefText: t('cov.openLib', { lib: lib.label }) };
    }
    return details;
  }
  return null;
}
