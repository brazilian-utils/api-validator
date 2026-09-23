'use client';
// Pick a document (CPF to start) and type its number: the field masks it as you type, shows it
// with the check digits highlighted, and whether it is valid. All of it is the
// JavaScript library (format*, parse*, isValid*, generate*), one entry point per function so the
// page stays light; the mask works like the library's "Document field" guide: format what was
// typed, and format what comes before the caret to place the caret.
import { formatCep } from '@brazilian-utils/brazilian-utils/format-cep';
import { formatCnh } from '@brazilian-utils/brazilian-utils/format-cnh';
import { formatCnpj } from '@brazilian-utils/brazilian-utils/format-cnpj';
import { formatCpf } from '@brazilian-utils/brazilian-utils/format-cpf';
import { formatLicensePlate } from '@brazilian-utils/brazilian-utils/format-license-plate';
import { formatPis } from '@brazilian-utils/brazilian-utils/format-pis';
import { formatVoterId } from '@brazilian-utils/brazilian-utils/format-voter-id';
import { generateCep } from '@brazilian-utils/brazilian-utils/generate-cep';
import { generateCnh } from '@brazilian-utils/brazilian-utils/generate-cnh';
import { generateCnpj } from '@brazilian-utils/brazilian-utils/generate-cnpj';
import { generateCpf } from '@brazilian-utils/brazilian-utils/generate-cpf';
import { generateLicensePlate } from '@brazilian-utils/brazilian-utils/generate-license-plate';
import { generatePis } from '@brazilian-utils/brazilian-utils/generate-pis';
import { generateVoterId } from '@brazilian-utils/brazilian-utils/generate-voter-id';
import { isValidCep } from '@brazilian-utils/brazilian-utils/is-valid-cep';
import { isValidCnh } from '@brazilian-utils/brazilian-utils/is-valid-cnh';
import { isValidCnpj } from '@brazilian-utils/brazilian-utils/is-valid-cnpj';
import { isValidCpf } from '@brazilian-utils/brazilian-utils/is-valid-cpf';
import { isValidLicensePlate } from '@brazilian-utils/brazilian-utils/is-valid-license-plate';
import { isValidPis } from '@brazilian-utils/brazilian-utils/is-valid-pis';
import { isValidVoterId } from '@brazilian-utils/brazilian-utils/is-valid-voter-id';
import { parseCep } from '@brazilian-utils/brazilian-utils/parse-cep';
import { parseCnh } from '@brazilian-utils/brazilian-utils/parse-cnh';
import { parseCnpj } from '@brazilian-utils/brazilian-utils/parse-cnpj';
import { parseCpf } from '@brazilian-utils/brazilian-utils/parse-cpf';
import { parseLicensePlate } from '@brazilian-utils/brazilian-utils/parse-license-plate';
import { parsePis } from '@brazilian-utils/brazilian-utils/parse-pis';
import { parseVoterId } from '@brazilian-utils/brazilian-utils/parse-voter-id';
import Link from '@/components/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Dices, XCircle } from 'lucide-react';

export interface Kind {
  domain: string;
  /** How many trailing characters are check digits (0: none). */
  check: number;
  title: string;
  href: string;
  /** A number from the contract's cases that passes validation, without its mask. */
  sample: string;
}

type Rule = {
  format: (v: string) => string;
  parse: (v: string) => string;
  valid: (v: string) => boolean;
  generate: () => string;
  /** Its own example is a real one: numbers of people get a broken check digit instead. */
  personal?: boolean;
};

const v2 = { version: 2 } as const;
const RULES: Record<string, Rule> = {
  cpf: { format: formatCpf, parse: parseCpf, valid: isValidCpf, generate: generateCpf, personal: true },
  pis: { format: formatPis, parse: parsePis, valid: isValidPis, generate: generatePis, personal: true },
  cnh: { format: formatCnh, parse: parseCnh, valid: isValidCnh, generate: generateCnh, personal: true },
  cnpj: {
    format: (v) => formatCnpj(v, v2),
    parse: (v) => parseCnpj(v, v2),
    valid: (v) => isValidCnpj(v, v2),
    generate: () => generateCnpj(v2),
  },
  voterId: { format: formatVoterId, parse: parseVoterId, valid: isValidVoterId, generate: generateVoterId, personal: true },
  cep: { format: formatCep, parse: parseCep, valid: isValidCep, generate: generateCep },
  licensePlate: {
    format: (v) => formatLicensePlate(v) || v.toUpperCase().replace(/[^0-9A-Z]/g, ''),
    parse: parseLicensePlate,
    valid: isValidLicensePlate,
    generate: generateLicensePlate,
  },
};

/** A well-formed number that fails validation: its last check digit changed. */
const broken = (rule: Rule, sample: string) => {
  for (let step = 1; step < 10; step++) {
    const candidate = sample.slice(0, -1) + ((Number(sample.at(-1)) + step) % 10);
    if (!rule.valid(candidate)) return candidate;
  }
  return sample;
};

/** The check digits the number should end with, asked of the library (at most 100 tries). */
const expectedCheck = (rule: Rule, alnum: string, check: number) => {
  if (!check || check > 2) return undefined;
  const base = alnum.slice(0, -check);
  for (let n = 0; n < 10 ** check; n++) {
    const digits = String(n).padStart(check, '0');
    if (rule.valid(base + digits)) return digits;
  }
  return undefined;
};

/** Splits the formatted value before its last `check` letters or digits. */
const splitCheck = (text: string, check: number): [string, string] => {
  let left = check;
  let cut = text.length;
  while (left > 0 && cut > 0) if (/[0-9A-Z]/i.test(text[--cut])) left--;
  return [text.slice(0, cut), text.slice(cut)];
};

export function Specimen({ kinds, text }: { kinds: Kind[]; text: Record<string, string> }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const examples = useMemo(
    () => Object.fromEntries(kinds.map((k) => [k.domain, RULES[k.domain].personal && k.check ? broken(RULES[k.domain], k.sample) : k.sample])),
    [kinds],
  );
  const [chosen, setChosen] = useState(kinds[0]?.domain ?? 'cpf');
  const [alnum, setAlnum] = useState(examples[chosen] ?? '');
  // The document is the one picked below (CPF to start); typing never switches it.
  const kind = kinds.find((k) => k.domain === chosen) ?? kinds[0];
  const rule = kind && RULES[kind.domain];
  const formatted = rule ? rule.format(alnum) : alnum;

  // The field owns its value (a controlled input would undo the mask): mask what is typed, then
  // put the caret where the same characters end up once formatted.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onInput = (event: Event) => {
      const inputType = (event as InputEvent).inputType ?? '';
      let typed = el.value;
      let position = el.selectionStart ?? typed.length;
      // The library's parse keeps what the document can hold (digits, or letters and digits),
      // cut to its length; its format masks that.
      const clean = (v: string) => (rule ? rule.parse(v).slice(0, kind.sample.length) : v);
      const format = (v: string) => (rule ? rule.format(clean(v)) : v);
      // A deleted separator would come straight back: delete the character next to it.
      if (inputType.startsWith('delete') && format(typed).length > typed.length) {
        if (inputType === 'deleteContentBackward') position -= 1;
        typed = typed.slice(0, position) + typed.slice(position + 1);
      }
      const caret = format(typed.slice(0, position)).length;
      el.value = format(typed);
      el.setSelectionRange(caret, caret);
      setAlnum(clean(typed));
    };
    el.addEventListener('input', onInput);
    return () => el.removeEventListener('input', onInput);
  }, [kind, rule]);

  // Examples, generated numbers and a new document write the field, masked.
  useEffect(() => {
    if (input.current && input.current.value !== formatted) input.current.value = formatted;
  }, [formatted]);

  const complete = !!kind && alnum.length >= kind.sample.length;
  const valid = complete && rule!.valid(alnum);
  const expected = complete && !valid ? expectedCheck(rule!, alnum, kind!.check) : undefined;
  const [head, digits] = kind && complete ? splitCheck(formatted, kind.check) : [formatted, ''];
  const mask = kind ? RULES[kind.domain].format(kind.sample.replace(/\d/g, '0').replace(/[A-Z]/gi, 'A')) : '';
  const pick = (domain: string, value?: string) => {
    setChosen(domain);
    setAlnum(value ?? examples[domain] ?? '');
  };

  return (
    <section aria-labelledby={`${id}-label`} className="rounded-2xl border bg-fd-background p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <label id={`${id}-label`} htmlFor={`${id}-input`} className="text-sm font-medium">
          {text.label}
        </label>
        {kind && (
          <button
            type="button"
            onClick={() => pick(kind.domain, rule!.parse(rule!.generate()))}
            aria-label={text.generate}
            title={text.generate}
            className="-m-1.5 rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground"
          >
            <Dices aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <input
        ref={input}
        id={`${id}-input`}
        defaultValue={formatted}
        placeholder={mask}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-describedby={`${id}-result`}
        className="mt-2 w-full rounded-lg border bg-fd-background px-3 py-2.5 font-mono text-lg tracking-wide outline-none placeholder:text-fd-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-fd-ring"
      />
      <p aria-hidden="true" className={`mt-4 min-h-[1.2em] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-3xl tracking-wider sm:text-4xl ${alnum ? '' : 'text-fd-muted-foreground/60'}`}>
        {alnum ? head : mask || ' '}
        {digits && <mark className={valid ? 'check' : 'check check-wrong'}>{digits}</mark>}
      </p>
      {/* As tall as its longest answer (two lines, three on a phone), so typing never moves the page. */}
      <div id={`${id}-result`} aria-live="polite" className="mt-3 min-h-16 text-sm sm:min-h-11">
        {!alnum ? (
          <p className="text-fd-muted-foreground">{text.empty}</p>
        ) : !kind ? null : (
          <>
            <p className="flex flex-wrap items-center gap-1.5">
              <Link href={kind.href} className="font-medium underline underline-offset-4">
                {kind.title}
              </Link>
              {complete ? (
                <>
                  {valid ? <CheckCircle2 aria-hidden className="size-4 text-ok" /> : <XCircle aria-hidden className="size-4 text-fail" />}
                  <span className={valid ? 'text-ok' : 'text-fail'}>{valid ? text.valid : text.invalid}</span>
                </>
              ) : (
                <span className="text-fd-muted-foreground">{(kind.sample.length - alnum.length === 1 ? text.missingOne : text.missingOther).replace('{n}', String(kind.sample.length - alnum.length))}</span>
              )}
            </p>
            {valid && kind.check > 0 && <p className="mt-1 text-fd-muted-foreground">{kind.check === 1 ? text.checkOne : text.checkOther.replace('{n}', String(kind.check))}</p>}
            {expected && (
              <p className="mt-1 text-fd-muted-foreground">
                {kind.check === 1 ? text.expectedOne : text.expectedOther} <mark className="check font-mono">{expected}</mark>.
              </p>
            )}
          </>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t pt-4 text-xs">
        <span className="me-1 text-fd-muted-foreground">{text.examples}</span>
        {kinds.map((k) => (
          <button
            key={k.domain}
            type="button"
            aria-pressed={kind?.domain === k.domain}
            onClick={() => pick(k.domain)}
            className="rounded-full border bg-fd-background px-2.5 py-1 transition-colors hover:bg-fd-accent aria-pressed:border-fd-primary aria-pressed:text-fd-primary"
          >
            {k.title}
          </button>
        ))}
      </div>
    </section>
  );
}
