// The home page: what the project does, a document number to type (masked and checked by the
// JavaScript library as you type), the same first call in each language, how the libraries give
// the same, and every utility by category.
import Link from '@/components/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { FlatTabs } from '@/components/flat-tabs';
import { ArrowRight } from 'lucide-react';
import { CATEGORIES, libNames, loadLibs, loadSpecs, loadStatus } from '@/lib/data';
import { Breakdown } from '@/components/breakdown';
import { breakdownUrl } from '@/lib/breakdown-data';
import { libraryBreakdown } from '@/lib/breakdown';
import { type Locale, pick, prefixOf, translator } from '@/lib/i18n';
import { baseOptions, headerProps } from '@/lib/layout';
import { HomeHeader } from '@/components/site-header.client';
import { SiteFooter } from '@/components/site-footer';
import { Markdown } from '@/lib/markdown';
import { loadUsage } from '@/lib/usage';
import { LangIcon } from '@/components/lang-icon';
import { guideExamples } from '@/components/pages/guide';
import { Specimen, type Kind } from '@/components/specimen.client';
import { HomeJsonLd } from '@/components/json-ld';

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);

/** The documents of the home page's field, and how many check digits each one ends with. */
const KINDS = [
  { domain: 'cpf', check: 2 },
  { domain: 'cnpj', check: 2 },
  { domain: 'cep', check: 0 },
  { domain: 'licensePlate', check: 0 },
  { domain: 'pis', check: 1 },
  { domain: 'cnh', check: 2 },
  { domain: 'voterId', check: 2 },
];

/** The first code block of a usage file, as Markdown. */
const firstCode = (body?: string) => body?.match(/^(`{3,})[^\n]*\n[\s\S]*?\n\1/m)?.[0];

export function HomePage({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const p = prefixOf(locale);
  const specs = loadSpecs();
  const libs = loadLibs();
  // The libraries by name, from libs/: the sentences follow the data, and never count them.
  const libList = libNames(locale);
  const lists = breakdownUrl(process.env.NEXT_PUBLIC_BASE ?? '', 'home', locale);
  const status = loadStatus();

  const cases = specs.reduce((n: number, s: any) => n + s.operations.reduce((m: number, o: any) => m + o.tests.length, 0), 0);
  const others = specs.length - 4;

  // Each document of the field and a number from its contract cases.
  const kinds: Kind[] = KINDS.flatMap(({ domain, check }) => {
    const spec = specs.find((s: any) => s.domain === domain);
    const op = spec?.operations.find((o: any) => o.id === 'isValid');
    const sample = (op?.tests as any[] | undefined)?.find((c: any) => c.returns === true && typeof c.args[0] === 'string')?.args[0];
    if (!spec || !op || !sample) return [];
    return [{ domain, check, title: pick(spec.title, locale), href: `${p}/utils/${spec.id}/`, sample: sample.toUpperCase().replace(/[^0-9A-Z]/g, '') }];
  });
  // The frameworks of the JavaScript library's document-field guide, as its tabs name them.
  const names = guideExamples(locale, 'javascript', 'document-field')?.map((e: any) => e.name).filter(Boolean) ?? [];
  const frameworks = names.length ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(names) : null;

  // The same first call in every language: install, then validate a CPF.
  const firstCalls = libs.map((lib: any) => {
    const summary = status?.libs?.[lib.id]?.summary;
    return { lib, code: firstCode(loadUsage(lib.id, 'cpf', 'isValid', locale)?.body), done: summary ? summary.ok + summary.failing : null, total: summary?.total };
  });

  const steps = [
    [L(locale, 'The contract', 'O contrato'), L(locale, 'Each function, its signature and its test cases are written once, in JSON, in the docs repository.', 'Cada função, com a assinatura e os casos de teste, é escrita uma vez em JSON no repositório docs.')],
    [L(locale, 'An issue per gap', 'Uma issue por lacuna'), L(locale, 'A library that lacks a function, or fails a case, gets an issue with the reference code.', 'Uma biblioteca sem a função, ou que falha num caso, recebe uma issue com o código de referência.')],
    [L(locale, 'The same tests', 'Os mesmos testes'), L(locale, 'Every library runs the shared cases in its own test suite, on every change.', 'Cada biblioteca roda os casos compartilhados na própria suíte de testes, a cada mudança.')],
    [L(locale, 'This site', 'Este site'), L(locale, 'Built from the contract and the latest run: what each library has and how to call each function.', 'Gerado a partir do contrato e da última execução: o que cada biblioteca tem e como chamar cada função.')],
  ];

  return (
    <HomeLayout {...baseOptions(locale)} nav={{ ...baseOptions(locale).nav, component: <HomeHeader {...headerProps(locale)} /> }}>
      <HomeJsonLd locale={locale} description={L(locale, `Validate, format, parse and generate Brazilian documents in ${libList}, with one shared contract.`, `Valide, formate, interprete e gere documentos brasileiros em ${libList}, com um contrato compartilhado.`)} />
      <div className="flex flex-1 flex-col">
        <section className="band">
          <div className="mx-auto grid w-full max-w-(--site-width) items-center gap-10 px-4 pt-14 pb-16 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:leading-[1.05]">
                {L(locale, 'Validate Brazilian documents in your language.', 'Valide documentos brasileiros na sua linguagem.')}
              </h1>
              <p className="mt-5 max-w-[34rem] text-lg text-fd-muted-foreground text-pretty">
                {L(
                  locale,
                  `CPF, CNPJ, CEP, license plates and ${others} more. A library for ${libList}, all checked against the same ${cases.toLocaleString('en')} shared test cases.`,
                  `CPF, CNPJ, CEP, placas e mais ${others}. Uma biblioteca para ${libList}, todas verificadas pelos mesmos ${cases.toLocaleString('pt-BR')} casos de teste compartilhados.`,
                )}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href={`${p}/getting-started/`} className={buttonVariants({ color: 'primary', className: 'gap-2 px-5 py-2.5 text-base' })}>
                  {t('home.start')} <ArrowRight aria-hidden className="size-4" />
                </Link>
                <Link href={`${p}/reference/parity/`} className="text-base font-medium underline decoration-fd-border underline-offset-4 transition-colors hover:decoration-fd-foreground">
                  {L(locale, 'Compare the libraries', 'Compare as bibliotecas')}
                </Link>
              </div>
            </div>
            <div className="min-w-0">
              <Specimen
                kinds={kinds}
                text={{
                  label: t('specimen.label'),
                  examples: t('specimen.examples'),
                  valid: t('specimen.valid'),
                  invalid: t('specimen.invalid'),
                  empty: t('specimen.empty'),
                  generate: t('specimen.generate'),
                  checkOne: t('specimen.checkDigits', { count: 1 }),
                  checkOther: t('specimen.checkDigits', { count: 9 }).replace('9', '{n}'),
                  missingOne: t('specimen.missing', { count: 1 }),
                  missingOther: t('specimen.missing', { count: 9 }).replace('9', '{n}'),
                  expectedOne: t('specimen.expected', { count: 1 }),
                  expectedOther: t('specimen.expected', { count: 2 }),
                }}
              />
              {frameworks && (
                <Link href={`${p}/guides/javascript/document-field/`} className="mt-3 inline-block text-sm font-medium hover:underline">
                  {L(locale, `This field in your project, in ${frameworks}`, `Este campo no seu projeto, em ${frameworks}`)}
                  <ArrowRight aria-hidden className="ms-1 inline size-3.5 align-[-0.125em]" />
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-(--site-width) gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">{L(locale, 'The same call, in your language', 'A mesma chamada, na sua linguagem')}</h2>
            <p className="mt-4 max-w-[36ch] text-fd-muted-foreground text-pretty">
              {L(
                locale,
                'Each library names its functions the way its language expects. Pick yours once: every page of this site opens on it.',
                'Cada biblioteca dá às funções os nomes que a linguagem espera. Escolha a sua uma vez: toda página do site abre nela.',
              )}
            </p>
          </div>
          <FlatTabs
            groupId="lang"
            persist
            className="!m-0 min-w-0"
            label={L(locale, 'Library', 'Biblioteca')}
            items={firstCalls.map(({ lib, code, done, total }) => ({
              value: lib.id,
              label: (
                <>
                  <LangIcon lib={lib.id} className="size-3.5" />
                  {lib.label}
                </>
              ),
              content: (
                <>
                  <Markdown source={'```' + lib.installLang + '\n' + lib.install + '\n```'} />
                  {code && <Markdown source={code} />}
                  <p className="not-prose flex flex-wrap items-center justify-between gap-2 text-sm text-fd-muted-foreground">
                    {done !== null && <span>{L(locale, `${done} of ${total} contract functions`, `${done} de ${total} funções do contrato`)}</span>}
                    <Link href={`${p}/libs/${lib.id}/`} className="inline-flex items-center gap-1 font-medium text-fd-foreground hover:underline">
                      {L(locale, `${lib.label} library`, `Biblioteca ${lib.label}`)} <ArrowRight aria-hidden className="size-3.5" />
                    </Link>
                  </p>
                </>
              ),
            }))}
          />
        </section>

        <section className="band band-top">
          <div className="mx-auto w-full max-w-(--site-width) px-4 py-16 sm:px-6 md:py-20">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">{L(locale, 'How every library gives the same answer', 'Como toda biblioteca dá a mesma resposta')}</h2>
            <p className="mt-4 max-w-[52ch] text-fd-muted-foreground text-pretty">
              {L(
                locale,
                'A function is defined once, and every library is held to that definition, in its own language and on its own schedule.',
                'Uma função é definida uma vez, e toda biblioteca é cobrada por essa definição, na própria linguagem e no próprio ritmo.',
              )}
            </p>
            <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(([title, body]) => (
                <li key={title} className="border-t pt-4">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-fd-muted-foreground text-pretty">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-(--site-width) px-4 py-16 sm:px-6 md:py-24">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{L(locale, 'Every utility', 'Todos os utilitários')}</h2>
          <p className="mt-3 max-w-[62ch] text-fd-muted-foreground text-pretty">{L(locale, 'Under each utility, the libraries that have it. Hover over or tap the line to see each library.', 'Embaixo de cada utilitário, as bibliotecas que o têm. Passe o mouse ou toque na linha para ver cada biblioteca.')}</p>
          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((c: any) => {
              const items = specs.filter((s: any) => s.category === c.id);
              if (!items.length) return null;
              return (
                <div key={c.id}>
                  <h3 className="text-sm font-semibold">{pick(c.label, locale)}</h3>
                  <ul className="mt-3 space-y-2.5 text-sm">
                    {items.map((s: any) => {
                      const b = libraryBreakdown(s, locale);
                      const util = pick(s.title, locale);
                      return (
                        <li key={s.id} className="flex flex-col gap-0.5">
                          <Link href={`${p}/utils/${s.id}/`} className="-my-0.5 inline-block py-0.5 transition-colors hover:text-fd-primary">
                            {util}
                          </Link>
                          <Breakdown src={lists} id={s.id} label={`${util} ${b.short}`} className="text-xs text-fd-muted-foreground">
                            {b.short}
                          </Breakdown>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <SiteFooter locale={locale} />
      </div>
    </HomeLayout>
  );
}
