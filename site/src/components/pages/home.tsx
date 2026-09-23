// The home page: what the project is, a document number to try, the seven libraries, how they stay
// the same, and every utility by category.
import Link from '@/components/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { ArrowRight, FileJson, GitPullRequest, ListChecks, MonitorSmartphone } from 'lucide-react';
import { CATEGORIES, coverage, isImplemented, loadLibs, loadSpecs, loadStatus } from '@/lib/data';
import { type Locale, pick, prefixOf, translator } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout';
import { LangIcon } from '@/components/lang-icon';
import { Specimen, type Kind } from '@/components/specimen.client';
import { HomeJsonLd } from '@/components/json-ld';

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);

const KINDS = [
  { domain: 'cpf', check: 2 },
  { domain: 'pis', check: 1 },
  { domain: 'cnh', check: 2 },
  { domain: 'cnpj', check: 2 },
  { domain: 'voterId', check: 2 },
  { domain: 'cep', check: 0 },
  { domain: 'licensePlate', check: 0 },
];

export function HomePage({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const p = prefixOf(locale);
  const specs = loadSpecs();
  const libs = loadLibs();
  const status = loadStatus();

  const kinds: Kind[] = KINDS.flatMap(({ domain, check }) => {
    const spec = specs.find((s: any) => s.domain === domain);
    const op = spec?.operations.find((o: any) => o.id === 'isValid');
    if (!spec || !op) return [];
    const example = (op.tests as any[]).find((c: any) => c.returns === true)?.args[0];
    const names = libs.flatMap((lib: any) => {
      const f = status?.libs?.[lib.id]?.functions?.[op.fnId];
      return f && isImplemented(f) ? [{ lib: lib.id, label: lib.label, symbol: f.symbol }] : [];
    });
    return [{ domain, check, title: pick(spec.title, locale), href: `${p}/utils/${spec.id}/`, example, names }];
  });

  const functions = specs.reduce((n: number, s: any) => n + s.operations.length, 0);
  const cases = specs.reduce((n: number, s: any) => n + s.operations.reduce((m: number, o: any) => m + o.tests.length, 0), 0);
  const stats = [
    [String(libs.length), L(locale, 'languages', 'linguagens')],
    [String(specs.length), L(locale, 'utilities', 'utilitários')],
    [String(functions), L(locale, 'functions in the contract', 'funções no contrato')],
    [cases.toLocaleString(locale), L(locale, 'shared test cases', 'casos de teste compartilhados')],
  ];

  const steps = [
    [FileJson, L(locale, 'Contract', 'Contrato'), L(locale, 'Each function, its signature and its test cases, once, in JSON.', 'Cada função, a assinatura e os casos de teste, uma vez, em JSON.')],
    [GitPullRequest, L(locale, 'Issues', 'Issues'), L(locale, 'A library that lacks a function gets an issue with the reference code.', 'Uma biblioteca sem a função recebe uma issue com o código de referência.')],
    [ListChecks, L(locale, 'Tests', 'Testes'), L(locale, 'Every library runs the shared cases with its own test command.', 'Cada biblioteca roda os casos compartilhados com o próprio comando de teste.')],
    [MonitorSmartphone, L(locale, 'This site', 'Este site'), L(locale, 'The contract, an example per language and the last results.', 'O contrato, um exemplo por linguagem e os últimos resultados.')],
  ] as const;

  return (
    <HomeLayout {...baseOptions(locale)} links={[{ text: L(locale, 'Documentation', 'Documentação'), url: `${p}/getting-started/`, active: 'nested-url' }]}>
      <HomeJsonLd locale={locale} description={L(locale, 'Validate, format and generate Brazilian documents in seven languages, with one shared contract.', 'Valide, formate e gere documentos brasileiros em sete linguagens, com um contrato compartilhado.')} />
      <div className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="border-b bg-[var(--color-header)]">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border bg-fd-background px-3 py-1 text-xs font-medium text-fd-muted-foreground">
                <span className="size-1.5 rounded-full bg-fd-primary" aria-hidden />
                {L(locale, 'One contract, seven languages', 'Um contrato, sete linguagens')}
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
                {L(locale, 'Brazilian documents, validated the same way in every language.', 'Documentos brasileiros, validados do mesmo jeito em toda linguagem.')}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-fd-muted-foreground text-pretty">
                {L(
                  locale,
                  'Validate, format and generate CPF, CNPJ, CEP, license plates, boletos and more. JavaScript, Python, Go, Ruby, Rust, .NET and Erlang pass the same test cases.',
                  'Valide, formate e gere CPF, CNPJ, CEP, placas, boletos e mais. JavaScript, Python, Go, Ruby, Rust, .NET e Erlang passam nos mesmos casos de teste.',
                )}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`${p}/getting-started/`} className={buttonVariants({ color: 'primary', className: 'gap-2 px-5 py-2.5 text-base' })}>
                  {t('home.start')} <ArrowRight className="size-4" />
                </Link>
                <Link href={`${p}/utils/cpf/`} className={buttonVariants({ color: 'outline', className: 'px-5 py-2.5 text-base' })}>
                  {t('home.browse')}
                </Link>
              </div>
            </div>
            <Specimen
              kinds={kinds}
              text={{
                label: t('specimen.label'),
                examples: t('specimen.examples'),
                valid: t('specimen.valid'),
                invalid: t('specimen.invalid'),
                unknown: t('specimen.unknown'),
                same: t('specimen.sameCheck'),
                checkOne: t('specimen.checkDigits', { count: 1 }),
                checkOther: t('specimen.checkDigits', { count: 2 }).replace('2', '{n}'),
              }}
            />
          </div>
        </section>

        {/* Numbers */}
        <section aria-label={L(locale, 'The project in numbers', 'O projeto em números')} className="border-b">
          <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 divide-fd-border px-4 sm:px-6 md:grid-cols-4 md:divide-x">
            {stats.map(([n, label]) => (
              <div key={label} className="flex flex-col-reverse gap-1 px-2 py-6 md:px-6">
                <dt className="text-sm text-fd-muted-foreground">{label}</dt>
                <dd className="text-3xl font-semibold tabular-nums tracking-tight">{n}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Libraries */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{L(locale, 'Pick your language', 'Escolha sua linguagem')}</h2>
          <p className="mt-2 max-w-2xl text-fd-muted-foreground">
            {L(locale, 'Same functions, named the way each language expects.', 'As mesmas funções, com os nomes que cada linguagem espera.')}
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {libs.map((lib: any) => {
              const summary = status?.libs?.[lib.id]?.summary;
              const core = summary ? Math.round(summary.coreCoverage) : null;
              return (
                <li key={lib.id}>
                  <Link href={`${p}/libs/${lib.id}/`} className="group flex h-full flex-col gap-4 rounded-xl border bg-fd-card p-5 transition-colors hover:border-fd-primary/60">
                    <span className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg border bg-fd-background">
                        <LangIcon lib={lib.id} className="size-5" />
                      </span>
                      <span>
                        <span className="block font-semibold">{lib.label}</span>
                        <span className="block text-xs text-fd-muted-foreground">{lib.package}</span>
                      </span>
                      <ArrowRight aria-hidden className="ms-auto size-4 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <code className="block break-all rounded-md border bg-fd-background px-3 py-2 font-mono text-xs">{lib.install}</code>
                    {core !== null && (
                      <span className="mt-auto flex items-center gap-3 text-xs text-fd-muted-foreground">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fd-secondary" aria-hidden>
                          <span className="block h-full rounded-full bg-fd-primary" style={{ width: `${core}%` }} />
                        </span>
                        <span className="tabular-nums">
                          {core}% {L(locale, 'of core', 'do core')} · {summary.ok + summary.failing}/{summary.total}
                        </span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* How */}
        <section className="border-y bg-[var(--color-header)]">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{L(locale, 'How the libraries stay the same', 'Como as bibliotecas ficam iguais')}</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(([Icon, title, body], i) => (
                <li key={title} className="rounded-xl border bg-fd-background p-5">
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-fd-primary/10 text-fd-primary">
                      <Icon aria-hidden className="size-4.5" />
                    </span>
                    <span className="font-mono text-xs text-fd-muted-foreground">0{i + 1}</span>
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-fd-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Utilities */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{L(locale, 'Every utility', 'Todos os utilitários')}</h2>
          <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((c: any) => {
              const items = specs.filter((s: any) => s.category === c.id);
              if (!items.length) return null;
              return (
                <div key={c.id}>
                  <h3 className="text-sm font-semibold">{pick(c.label, locale)}</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {items.map((s: any) => {
                      const done = libs.filter((lib: any) => coverage(s, lib.id).count > 0).length;
                      return (
                        <li key={s.id} className="flex items-baseline gap-2">
                          <Link href={`${p}/utils/${s.id}/`} className="text-fd-muted-foreground transition-colors hover:text-fd-foreground">
                            {pick(s.title, locale)}
                          </Link>
                          <span className="text-xs text-fd-muted-foreground tabular-nums" title={L(locale, 'libraries that implement it', 'bibliotecas que implementam')}>
                            {done}/{libs.length}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="border-t bg-[var(--color-header)]">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-fd-muted-foreground sm:px-6">
            <p>Brazilian Utils · MIT</p>
            <p className="flex gap-5">
              <Link href={`${p}/reference/parity/`} className="hover:text-fd-foreground">{L(locale, 'Parity matrix', 'Matriz de paridade')}</Link>
              <Link href={`${p}/contributing/specs/`} className="hover:text-fd-foreground">{L(locale, 'Contributing', 'Contribuindo')}</Link>
              <a href="https://github.com/brazilian-utils" className="hover:text-fd-foreground">GitHub</a>
            </p>
          </div>
        </footer>
      </div>
    </HomeLayout>
  );
}
