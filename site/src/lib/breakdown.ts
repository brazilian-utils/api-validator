// What a coverage summary says in words ("no Generate", "3 missing", "not in Go and .NET") and the
// list behind it, for <Breakdown>: the site never shows a bare "4/5".
import type { BreakdownItem } from '@/components/breakdown.client';
import type { Status } from '@/components/status';
import { coverage, isImplemented, loadLibs } from './data';
import { type Locale, pick, translator } from './i18n';

const list = (locale: Locale, xs: string[]) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(xs);

/**
 * One library and one utility: each function and its state. `names` spells out up to two missing
 * or failing functions in the summary (where there is room for them).
 */
export function functionBreakdown(spec: any, libId: string, locale: Locale, { names = true } = {}) {
  const t = translator(locale);
  const c = coverage(spec, libId);
  // The icon says the state; the line under the name says what the function does.
  const items: BreakdownItem[] = c.detail.map((d: any) => ({
    label: pick(d.op.label, locale),
    status: d.status as Status,
    note: pick(d.op.summary, locale),
  }));
  const missing = c.detail.filter((d: any) => !isImplemented(d)).map((d: any) => pick(d.op.label, locale));
  const failing = c.detail.filter((d: any) => d.status === 'failing').map((d: any) => pick(d.op.label, locale));
  const short =
    c.state === 'none'
      ? t('cov.none')
      : failing.length
        ? names && failing.length <= 2
          ? t('cov.fails', { count: failing.length, list: list(locale, failing) })
          : t('cov.failCount', { count: failing.length })
        : !missing.length
          ? t('cov.all')
          : names && missing.length <= 2
            ? t('cov.without', { list: list(locale, missing) })
            : t('cov.missing', { count: missing.length });
  return { state: c.state as Status, short, items };
}

/** One utility across the libraries: which have it, and how much of it each one has. */
export function libraryBreakdown(spec: any, locale: Locale) {
  const t = translator(locale);
  const libs = loadLibs();
  const per = libs.map((lib: any) => ({ lib, ...functionBreakdown(spec, lib.id, locale) }));
  const have = per.filter((x: any) => x.state !== 'none');
  const lacking = per.filter((x: any) => x.state === 'none').map((x: any) => x.lib.label);
  const short =
    have.length === libs.length
      ? t('cov.libsAll')
      : !have.length
        ? t('cov.none')
        : lacking.length <= 2
          ? t('cov.libsWithout', { list: list(locale, lacking) })
          : have.length <= 2
            ? t('cov.libsOnly', { list: list(locale, have.map((x: any) => x.lib.label)) })
            : t('cov.libsSome', { count: have.length });
  const state: Status = !have.length ? 'none' : per.every((x: any) => x.state === 'full') ? 'full' : 'partial';
  const items: BreakdownItem[] = per.map((x: any) => ({ label: x.lib.label, status: x.state, note: x.short }));
  return { state, short, items };
}
