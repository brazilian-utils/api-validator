'use client';
// Type a Brazilian document number: which document it is, formatted with the check digits
// highlighted, valid or not, and the same check in every library. Runs the JavaScript library in
// the browser, one entry point per function so the page stays light.
import { formatCep } from '@brazilian-utils/brazilian-utils/format-cep';
import { formatCnh } from '@brazilian-utils/brazilian-utils/format-cnh';
import { formatCnpj } from '@brazilian-utils/brazilian-utils/format-cnpj';
import { formatCpf } from '@brazilian-utils/brazilian-utils/format-cpf';
import { formatLicensePlate } from '@brazilian-utils/brazilian-utils/format-license-plate';
import { formatPis } from '@brazilian-utils/brazilian-utils/format-pis';
import { formatVoterId } from '@brazilian-utils/brazilian-utils/format-voter-id';
import { isValidCep } from '@brazilian-utils/brazilian-utils/is-valid-cep';
import { isValidCnh } from '@brazilian-utils/brazilian-utils/is-valid-cnh';
import { isValidCnpj } from '@brazilian-utils/brazilian-utils/is-valid-cnpj';
import { isValidCpf } from '@brazilian-utils/brazilian-utils/is-valid-cpf';
import { isValidLicensePlate } from '@brazilian-utils/brazilian-utils/is-valid-license-plate';
import { isValidPis } from '@brazilian-utils/brazilian-utils/is-valid-pis';
import { isValidVoterId } from '@brazilian-utils/brazilian-utils/is-valid-voter-id';
import Link from '@/components/link';
import { useId, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface Kind {
  domain: string;
  check: number;
  title: string;
  href: string;
  example?: string;
  names: Array<{ lib: string; label: string; symbol: string }>;
}

// `mask`: the written format; a value typed with it says which document the reader means.
type Rule = { fits: (a: string) => boolean; mask?: RegExp; valid: (v: string) => boolean; format: (v: string) => string };
const RULES: Record<string, Rule> = {
  cpf: { fits: (a) => /^\d{11}$/.test(a), mask: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/, valid: isValidCpf, format: formatCpf },
  pis: { fits: (a) => /^\d{11}$/.test(a), mask: /^\d{3}\.\d{5}\.\d{2}-\d$/, valid: isValidPis, format: formatPis },
  cnh: { fits: (a) => /^\d{11}$/.test(a), valid: isValidCnh, format: formatCnh },
  cnpj: { fits: (a) => /^[0-9A-Z]{12}\d{2}$/.test(a), mask: /^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}$/i, valid: (v) => isValidCnpj(v, { version: 2 }), format: (v) => formatCnpj(v, { version: 2 }) },
  voterId: { fits: (a) => /^\d{12}$/.test(a), valid: isValidVoterId, format: formatVoterId },
  cep: { fits: (a) => /^\d{8}$/.test(a), mask: /^\d{5}-\d{3}$/, valid: isValidCep, format: formatCep },
  licensePlate: { fits: (a) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(a), valid: isValidLicensePlate, format: (v) => formatLicensePlate(v) || v },
};

const detect = (kinds: Kind[], value: string) => {
  const alnum = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const fitting = kinds.filter((k) => RULES[k.domain]?.fits(alnum));
  return fitting.find((k) => RULES[k.domain].mask?.test(value)) ?? fitting.find((k) => RULES[k.domain].valid(value)) ?? fitting[0];
};

/** Splits the formatted value before its last `check` alphanumerics. */
const splitCheck = (text: string, check: number): [string, string] => {
  let left = check;
  let cut = text.length;
  while (left > 0 && cut > 0) if (/[0-9A-Z]/i.test(text[--cut])) left--;
  return [text.slice(0, cut), text.slice(cut)];
};

export function Specimen({ kinds, text }: { kinds: Kind[]; text: Record<string, string> }) {
  const id = useId();
  const [value, setValue] = useState(kinds.find((k) => k.domain === 'cpf')?.example ?? '');
  const v = value.trim();
  const kind = v ? detect(kinds, v) : undefined;
  const rule = kind && RULES[kind.domain];
  const valid = rule ? rule.valid(v) : false;
  const formatted = rule ? rule.format(v) || v : v;
  const [head, digits] = kind && valid ? splitCheck(formatted, kind.check) : [formatted, ''];

  return (
    <section aria-labelledby={`${id}-label`} className="rounded-2xl border bg-fd-card p-5 shadow-sm sm:p-6">
      <label id={`${id}-label`} htmlFor={`${id}-input`} className="text-sm font-medium">
        {text.label}
      </label>
      <input
        id={`${id}-input`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={`${id}-result`}
        className="mt-2 w-full rounded-lg border bg-fd-background px-3 py-2.5 font-mono text-lg tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
      />
      <p aria-hidden="true" className="mt-4 min-h-[1.2em] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-3xl tracking-wider sm:text-4xl">
        {head || ' '}
        {digits && <mark className="check">{digits}</mark>}
      </p>
      <div id={`${id}-result`} aria-live="polite" className="mt-3 min-h-6 text-sm">
        {kind ? (
          <>
            <p className="flex flex-wrap items-center gap-1.5">
              <Link href={kind.href} className="font-medium underline underline-offset-4">
                {kind.title}
              </Link>
              {valid ? <CheckCircle2 aria-hidden className="size-4 text-ok" /> : <XCircle aria-hidden className="size-4 text-fail" />}
              <span className={valid ? 'text-ok' : 'text-fail'}>{valid ? text.valid : text.invalid}</span>
            </p>
            {valid && kind.check > 0 && <p className="mt-1 text-fd-muted-foreground">{kind.check === 1 ? text.checkOne : text.checkOther.replace('{n}', String(kind.check))}</p>}
            {kind.names.length > 0 && (
              <>
              <p className="mt-4 mb-1 text-xs text-fd-muted-foreground">{text.same}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                {kind.names.map((n) => (
                  <div key={n.lib} className="contents">
                    <dt className="text-fd-muted-foreground">{n.label}</dt>
                    <dd>
                      <code className="font-mono">{n.symbol}</code>
                    </dd>
                  </div>
                ))}
              </dl>
              </>
            )}
          </>
        ) : (
          v && <p className="text-fd-muted-foreground">{text.unknown}</p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t pt-4 text-xs">
        <span className="me-1 text-fd-muted-foreground">{text.examples}</span>
        {kinds
          .filter((k) => k.example)
          .map((k) => (
            <button
              key={k.domain}
              type="button"
              onClick={() => setValue(k.example!)}
              className="rounded-full border bg-fd-background px-2.5 py-1 transition-colors hover:bg-fd-accent"
            >
              {k.title}
            </button>
          ))}
      </div>
    </section>
  );
}
