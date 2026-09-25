// The shared test cases of one function and the result in each library, as the data of a table:
// written at build time (api/cases/…) and fetched by the utility page when the reader opens the
// cases (lazy-cases.client.tsx). A utility page carries a few hundred cases, and a phone should
// not parse them (twice: the markup and the hydration data) to read a signature.
import type { Status } from '@/components/status';
import { expectation, loadLibs, loadSpecs, loadStatus, testIds } from '@/lib/data';
import { type Locale, translator } from '@/lib/i18n';

export interface CasesData {
  /** The libraries with a validator run, in the site's order: one column each. */
  libs: Array<{ id: string; label: string }>;
  input: string;
  expected: string;
  rows: Array<{ id: string; args: string; expected: string; note?: string; results: Array<[Status, string]> }>;
}

/** The cases of one function, or null when the utility or the function is not in the contract. */
export function casesData(locale: Locale, utilId: string, opId: string): CasesData | null {
  const spec = loadSpecs().find((s: any) => s.id === utilId);
  const op = spec?.operations.find((o: any) => o.id === opId);
  if (!op?.tests?.length) return null;
  const t = translator(locale);
  const status = loadStatus();
  const libs = loadLibs().filter((lib: any) => status?.libs?.[lib.id]);
  const ids = testIds(op.fnId, op.tests);
  const result = (libId: string, caseId: string): [Status, string] => {
    const f = status?.libs?.[libId]?.functions?.[op.fnId];
    if (!f || f.status === 'missing' || f.status === 'waived') return [f?.status === 'waived' ? 'waived' : 'missing', t(`status.${f?.status === 'waived' ? 'waived' : 'missing'}`)];
    const r = f.results?.[caseId];
    if (!r) return ['waived', t('cases.notRun')];
    return [r === 'pass' ? 'ok' : r === 'skip' ? 'waived' : 'failing', t(`cases.${r}`)];
  };
  const show = (v: unknown) => JSON.stringify(v ?? []).slice(1, -1);
  return {
    libs: libs.map((lib: any) => ({ id: lib.id, label: lib.label })),
    input: t('testcases.input'),
    expected: t('testcases.expected'),
    rows: op.tests.map((test: any, i: number) => ({
      id: ids[i],
      args: show(test.args),
      expected: expectation(test),
      ...(test.note ? { note: test.note } : {}),
      results: libs.map((lib: any) => result(lib.id, ids[i])),
    })),
  };
}
