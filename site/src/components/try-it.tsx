// "Try it": runs the function with the reference library (JavaScript) in the browser. Only for
// functions the published package has.
import * as reference from '@brazilian-utils/brazilian-utils';
import { Disclosure } from './disclosure';
import pkg from '@brazilian-utils/brazilian-utils/package.json';
import { isImplemented, loadLibs, loadStatus } from '@/lib/data';
import { type Locale, translator } from '@/lib/i18n';
import { TryItForm, type Field } from './try-it.client';

const kind = (type: string): Field['kind'] => {
  const parts = type.split('|').map((s) => s.trim());
  for (const k of ['string', 'number', 'date', 'boolean'] as const) if (parts.includes(k)) return k;
  return 'json';
};

export function TryIt({ op, locale }: { op: any; locale: Locale }) {
  const t = translator(locale);
  const lib = loadLibs().find((l: any) => l.id === 'javascript');
  const fn = loadStatus()?.libs?.javascript?.functions?.[op.fnId];
  if (!lib || !isImplemented(fn) || typeof (reference as Record<string, unknown>)[fn.symbol] !== 'function') return null;
  const first = op.tests.find((c: any) => Array.isArray(c.args)) ?? { args: [] };
  const fields: Field[] = op.params.map((p: any, i: number) => {
    const k = kind(p.type);
    const v = first.args[i];
    return { name: p.name, type: p.type, optional: !!p.optional, kind: k, value: v === undefined ? '' : k === 'json' ? JSON.stringify(v) : String(v) };
  });
  const cases = op.tests.filter((c: any) => 'returns' in c).map((c: any) => ({ args: c.args, returns: c.returns }));
  return (
    <Disclosure title={<span>{t('try.title', { lib: lib.label })} <code className="font-normal">{fn.symbol}</code></span>} id={`try-${op.fnId.replace('.', '-')}`}>
      <TryItForm
        symbol={fn.symbol}
        fields={fields}
        cases={cases}
        text={{ run: t('try.run'), hint: t('try.hint'), matches: t('try.matches'), differs: t('try.differs'), note: t('try.note', { package: `${lib.package} ${pkg.version}` }) }}
      />
    </Disclosure>
  );
}
