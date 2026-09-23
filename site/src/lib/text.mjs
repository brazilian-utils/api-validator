// Small helpers shared by the components and the page generator.

/** Anchor Starlight gives a heading (github-slugger rules, which Astro uses). */
export function headingSlug(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** `isValid(cpf: string) -> boolean` for a contract operation. */
export function signature(op) {
  const params = op.params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
  return `${op.fnId}(${params}) → ${op.returns}`;
}

/** What a contract test expects, as short text. */
export function expectation(test) {
  if ('returns' in test) return test.returns === null ? 'null' : JSON.stringify(test.returns);
  if (test.throws) return 'error';
  if ('matches' in test) return `/${test.matches}/`;
  if ('satisfies' in test) return `✓ ${test.satisfies}`;
  return '';
}

/** Stable id of a contract test, as the validator computes it (name, else the args; ~N for repeats). */
export function testIds(fnId, tests) {
  const seen = new Map();
  return tests.map((t) => {
    let key = t.name ?? JSON.stringify(t.args ?? []);
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n > 0) key = `${key}~${n + 1}`;
    return `${fnId}#${key}`;
  });
}

/** Marks for a function's status in a library, and for one shared case. Text first, color second. */
export const STATUS_MARK = { ok: '✓', failing: '✕', signature: '!', missing: '○', waived: '–' };
export const STATUS_CLASS = { ok: 'bu-ok', failing: 'bu-fail', signature: 'bu-warn', missing: 'bu-none', waived: 'bu-none' };
export const CASE_MARK = { pass: '✓', fail: '✕', 'known-failure': '✕', skip: '–' };

/** Implemented: present in the library, whatever its cases do. */
export const isImplemented = (f) => f?.status === 'ok' || f?.status === 'failing';

/** Link to one operation on its utility page (the heading id Starlight gives its label). */
export const opPath = (prefix, spec, op, locale) => `${prefix}/utils/${spec.id}/#${headingSlug(op.label[locale] ?? op.label.en)}`;
