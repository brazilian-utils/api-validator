'use client';
import { useEffect, useRef, useState } from 'react';

export interface Field {
  name: string;
  type: string;
  optional: boolean;
  kind: 'string' | 'number' | 'date' | 'boolean' | 'json';
  value: string;
}

type Lib = Record<string, (...args: unknown[]) => unknown>;
let lib: Promise<Lib> | undefined;
const load = () =>
  (lib ??= import('@brazilian-utils/brazilian-utils').catch((e) => {
    lib = undefined;
    throw e;
  }) as unknown as Promise<Lib>);

const show = (v: unknown) => (v === undefined ? 'undefined' : JSON.stringify(v, (_, x) => (x instanceof Date ? x.toISOString() : x)));

export function TryItForm({ symbol, fields, cases, text }: { symbol: string; fields: Field[]; cases: Array<{ args: unknown[]; returns: unknown }>; text: Record<string, string> }) {
  const [values, setValues] = useState(() => fields.map((f) => f.value));
  const [out, setOut] = useState<{ value?: string; verdict?: [boolean, string]; error?: string } | null>(null);
  const seq = useRef(0);

  const args = () => {
    const list = fields.map((f, i) => {
      const v = values[i];
      if (f.kind === 'boolean') return v === 'true';
      if (v === '') return undefined;
      if (f.kind === 'number') return Number(v);
      if (f.kind === 'date') return new Date(v);
      if (f.kind === 'json') return JSON.parse(v);
      return v;
    });
    while (list.length && list[list.length - 1] === undefined) list.pop();
    return list;
  };

  const run = async () => {
    const n = ++seq.current;
    try {
      const input = args();
      const result = await (await load())[symbol](...input);
      if (n !== seq.current) return;
      const known = cases.find((c) => JSON.stringify(c.args) === JSON.stringify(input));
      const same = known && JSON.stringify(known.returns) === JSON.stringify(result ?? null);
      setOut({ value: show(result), verdict: known ? [!!same, same ? text.matches : `${text.differs} ${show(known.returns)}`] : undefined });
    } catch (e) {
      if (n === seq.current) setOut({ error: String((e as Error)?.message ?? e) });
    }
  };

  // Closed, the box loads nothing: the library comes in when the reader opens it.
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const details = form.current?.closest('details');
    const sync = () => setOpen(details ? details.open : true);
    const frame = requestAnimationFrame(sync);
    details?.addEventListener('toggle', sync);
    return () => {
      cancelAnimationFrame(frame);
      details?.removeEventListener('toggle', sync);
    };
  }, []);

  // A playground, not a form: it answers as you type.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(run, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, open]);

  return (
    <form
      ref={form}
      className="not-prose flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run();
      }}
    >
      <div className="flex flex-wrap gap-3 items-end">
        {fields.map((f, i) => (
          <label key={f.name} className="flex flex-1 basis-48 flex-col gap-1 text-xs text-fd-muted-foreground">
            <span>
              {f.name}
              {f.optional ? '?' : ''} <code className="text-[0.7rem]">{f.type}</code>
            </span>
            {f.kind === 'boolean' ? (
              <input type="checkbox" checked={values[i] === 'true'} onChange={(e) => setValues(values.map((v, j) => (j === i ? String(e.target.checked) : v)))} />
            ) : (
              <input
                type={f.kind === 'number' ? 'number' : 'text'}
                step="any"
                value={values[i]}
                spellCheck={false}
                autoComplete="off"
                placeholder={f.kind === 'json' ? '{ } JSON' : f.kind === 'date' ? '2026-01-31' : ''}
                onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}
                className="rounded-md border bg-fd-background px-2.5 py-1.5 font-mono text-sm text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-ring"
              />
            )}
          </label>
        ))}
        <button type="submit" className="rounded-md bg-fd-primary px-3 py-1.5 text-sm font-medium text-fd-primary-foreground">
          {text.run}
        </button>
      </div>
      <output aria-live="polite" className="flex min-h-10 flex-wrap items-center gap-3 rounded-md bg-fd-background px-3 py-2 text-sm">
        {!out && <span className="text-fd-muted-foreground">{text.hint}</span>}
        {out?.value !== undefined && <code className="font-mono">{out.value}</code>}
        {out?.verdict && <span className={`text-xs ${out.verdict[0] ? 'text-ok' : 'text-fail'}`}>{out.verdict[1]}</span>}
        {out?.error && <span className="text-xs text-fail">{out.error}</span>}
      </output>
      <p className="text-xs text-fd-muted-foreground">{text.note}</p>
    </form>
  );
}
