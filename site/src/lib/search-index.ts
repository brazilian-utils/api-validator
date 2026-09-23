// What the search finds: every utility (with its function names in every library), library,
// guide and hand-written page, in both languages.
import { CATEGORIES, loadGuides, loadLibs, loadSpecs, loadStatus } from './data';
import { LOCALES, type Locale, pick, prefixOf } from './i18n';
import { slug } from './prose';
import { source } from './source';
import { libDescription, libTitle } from '@/components/pages/lib';
import { parityText } from '@/components/pages/parity';

const trim = (url: string) => url.replace(/\/$/, '') || '/';

export function searchIndexes() {
  const libs = loadLibs();
  const status = loadStatus();
  const out: Array<{ title: string; description?: string; content: string; url: string; breadcrumbs?: string[]; keywords?: string; locale: Locale }> = [];
  for (const locale of LOCALES) {
    const p = prefixOf(locale);
    for (const spec of loadSpecs() as any[]) {
      const category = pick(CATEGORIES.find((c: any) => c.id === spec.category)?.label, locale);
      out.push({ locale, title: pick(spec.title, locale), description: pick(spec.summary, locale), content: pick(spec.summary, locale), url: `${p}/utils/${spec.id}`, breadcrumbs: [category] });
      for (const op of spec.operations) {
        const symbols = libs.map((l: any) => status?.libs?.[l.id]?.functions?.[op.fnId]?.symbol).filter(Boolean);
        out.push({
          locale,
          title: `${pick(spec.title, locale)}: ${pick(op.label, locale)}`,
          description: op.fnId,
          content: [pick(op.description ?? op.summary, locale), op.fnId, ...symbols].join(' '),
          keywords: symbols.join(' '),
          url: `${p}/utils/${spec.id}#${slug(pick(op.label, locale))}`,
          breadcrumbs: [category, pick(spec.title, locale)],
        });
      }
    }
    for (const lib of libs as any[]) out.push({ locale, title: libTitle(locale, lib.label), description: libDescription(locale, lib.label), content: `${lib.package} ${lib.install}`, url: `${p}/libs/${lib.id}` });
    for (const g of loadGuides() as any[]) out.push({ locale, title: pick(g.title, locale), description: pick(g.description, locale), content: pick(g.description, locale), url: `${p}/guides/${g.lib}/${g.slug}` });
    const parity = parityText(locale);
    out.push({ locale, title: parity.title, description: parity.description, content: parity.description, url: `${p}/reference/parity` });
    for (const page of source.getPages(locale)) out.push({ locale, title: page.data.title, description: page.data.description, content: page.data.description ?? '', url: trim(`${p}${page.url.replace(/^\/pt-BR/, '')}`) });
  }
  return out;
}
