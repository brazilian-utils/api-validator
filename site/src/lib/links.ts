import { loadSpecs } from './data';
import { type Locale, pick, prefixOf } from './i18n';
import { slug } from './prose';

/** contract function id → its section on the utility page, with a readable label. */
export function functionLinks(locale: Locale) {
  const p = prefixOf(locale);
  const out = new Map<string, { href: string; label: string }>();
  for (const spec of loadSpecs() as any[])
    for (const op of spec.operations) out.set(op.fnId, { href: `${p}/utils/${spec.id}/#${slug(pick(op.label, locale))}`, label: `${pick(spec.title, locale)}: ${pick(op.label, locale)}` });
  return out;
}
