// A utility page (CPF, CEP, license plate…): what it is, which library has what, then one block
// per contract function (signature, parameters, usage in every language, try it, shared cases),
// then the long-form spec and the official sources.
import fs from 'node:fs';
import path from 'node:path';
import Link from '@/components/link';
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle, PageLastUpdate } from 'fumadocs-ui/layouts/notebook/page';
import { lastCommit } from '@/lib/git';
import { Callout } from 'fumadocs-ui/components/callout';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { BookOpen, ExternalLink, FileJson, Pencil } from 'lucide-react';
import { CONTRACT_DIR, REPO_URL, coverage, expectation, isImplemented, loadGuides, loadLibs, loadReferenceFiles, loadReferences, loadSpec, loadStatus, signature, testIds } from '@/lib/data';
import { type Locale, pick, prefixOf, translator } from '@/lib/i18n';
import { Markdown } from '@/lib/markdown';
import { demote, linkFindings, slug, splitPending } from '@/lib/prose';
import { loadUsage, sinceOf } from '@/lib/usage';
import { LangIcon } from '@/components/lang-icon';
import { StatusIcon, type Status } from '@/components/status';
import { TryIt } from '@/components/try-it';

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);

export async function UtilPage({ locale, id }: { locale: Locale; id: string }) {
  const spec = loadSpec(id);
  if (!spec) notFound();
  const t = translator(locale);
  const p = prefixOf(locale);
  const libs = loadLibs();
  const status = loadStatus();
  const guides = loadGuides().filter((g: any) => g.fns.some((fn: string) => spec.operations.some((op: any) => op.fnId === fn)));
  const related = spec.related.map((r: string) => loadSpec(r)).filter(Boolean);
  const specFile = path.join(CONTRACT_DIR, spec.domain, `spec.${locale}.md`);
  const other = path.join(CONTRACT_DIR, spec.domain, `spec.${locale === 'en' ? 'pt-BR' : 'en'}.md`);
  // The long-form spec in the page's language, else the other one with a notice.
  const specIsFallback = !fs.existsSync(specFile) && fs.existsSync(other);
  const longSpec = fs.existsSync(specFile) ? fs.readFileSync(specFile, 'utf8') : specIsFallback ? fs.readFileSync(other, 'utf8') : null;
  const references = loadReferences(id);
  const localCopies = loadReferenceFiles(id);
  // On a Portuguese page: some function descriptions exist only in English (no pt-BR yet).
  const englishOnly = locale !== 'en' && spec.operations.some((op: any) => (op.description ?? op.summary) && !(op.description ?? op.summary)?.[locale]);

  const ops = spec.operations.map((op: any) => ({ op, label: pick(op.label, locale), anchor: slug(pick(op.label, locale)) }));
  const toc = [
    ...ops.map(({ label, anchor }) => ({ title: label, url: `#${anchor}`, depth: 2 })),
    ...(longSpec ? [{ title: L(locale, 'Specification', 'Especificação'), url: '#specification', depth: 2 }] : []),
    { title: L(locale, 'Official sources', 'Fontes oficiais'), url: '#official-sources', depth: 2 },
  ];

  return (
    <DocsPage toc={toc} tableOfContent={{ style: 'clerk' }}>
      <DocsTitle>{pick(spec.title, locale)}</DocsTitle>
      <DocsDescription className="mb-0">{pick(spec.summary, locale)}</DocsDescription>

      <div className="flex flex-wrap gap-2 not-prose">
        <a className={buttonVariants({ color: 'secondary', size: 'sm', className: 'gap-1.5' })} href={`${REPO_URL}/blob/main/contract/${spec.domain}.json`} target="_blank" rel="noopener noreferrer">
          <FileJson className="size-3.5" /> {L(locale, 'Contract', 'Contrato')}
        </a>
        <a className={buttonVariants({ color: 'secondary', size: 'sm', className: 'gap-1.5' })} href={`${REPO_URL}/edit/main/contract/${spec.domain}.json`} target="_blank" rel="noopener noreferrer">
          <Pencil className="size-3.5" /> {L(locale, 'Edit', 'Editar')}
        </a>
      </div>

      {/* Which library implements how much of this utility. */}
      <div className="not-prose grid grid-cols-2 gap-2 sm:grid-cols-4">
        {libs.map((lib: any) => {
          const c = coverage(spec, lib.id);
          const since = sinceOf(lib.id, spec.id);
          return (
            <Link
              key={lib.id}
              href={`${p}/libs/${lib.id}/`}
              className="flex flex-col gap-2 rounded-lg border bg-fd-card p-3 transition-colors hover:border-fd-primary/50 hover:bg-fd-accent"
            >
              <span className="flex items-center justify-between gap-2">
                <LangIcon lib={lib.id} className="size-5" />
                <span className="flex items-center gap-1 text-xs text-fd-muted-foreground tabular-nums">
                  <StatusIcon status={c.state as Status} label={t(`parity.${c.state}`)} className="size-3.5" />
                  {c.count}/{c.total}
                </span>
              </span>
              <span className="truncate text-sm font-medium">{lib.label}</span>
              {since && <span className="-mt-1.5 text-xs text-fd-muted-foreground">{t('util.since', { version: since })}</span>}
            </Link>
          );
        })}
      </div>

      <DocsBody>
        {englishOnly && <p className="text-sm text-fd-muted-foreground">{t('ops.englishOnly')}</p>}
        {ops.map(({ op, label, anchor }) => (
          <Operation key={op.fnId} op={op} label={label} anchor={anchor} spec={spec} locale={locale} libs={libs} status={status} />
        ))}

        {guides.length > 0 && (
          <>
            <h2 id="guides">{L(locale, 'Guides', 'Guias')}</h2>
            <Cards>
              {guides.map((g: any) => (
                <Card key={g.slug} icon={<BookOpen />} title={pick(g.title, locale)} description={pick(g.description, locale)} href={`${p}/guides/${g.lib}/${g.slug}/`} />
              ))}
            </Cards>
          </>
        )}

        {longSpec && (
          <>
            <h2 id="specification">{L(locale, 'Specification', 'Especificação')}</h2>
            {specIsFallback && <Callout type="warn">{t('spec.fallback')}</Callout>}
            <Markdown source={demote(longSpec)} />
          </>
        )}

        <h2 id="official-sources">{L(locale, 'Official sources', 'Fontes oficiais')}</h2>
        {references.length === 0 && localCopies.length === 0 && <p>{t('references.none')}</p>}
        {references.length > 0 && (
          <ul>
            {references.map((r: any) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        )}
        {localCopies.length > 0 && (
          <Accordions type="single">
            <Accordion title={`${t('references.localCopy')} (${localCopies.length})`} id="local-copies">
              <ul>
                {localCopies.map((f: any) => (
                  <li key={f.name}>
                    <a href={`${REPO_URL}/blob/main/${encodeURI(f.repoPath)}`} target="_blank" rel="noopener noreferrer">
                      {f.name}
                    </a>
                  </li>
                ))}
              </ul>
            </Accordion>
          </Accordions>
        )}

        {related.length > 0 && (
          <p className="text-sm text-fd-muted-foreground">
            {t('util.related')}{' '}
            {related.map((r: any, i: number) => (
              <span key={r.id}>
                {i > 0 && ', '}
                <Link href={`${p}/utils/${r.id}/`}>{pick(r.title, locale)}</Link>
              </span>
            ))}
          </p>
        )}
      </DocsBody>
      <LastUpdate date={lastCommit(`contract/${spec.domain}.json`, `contract/${spec.domain}`)} />
    </DocsPage>
  );
}

function LastUpdate({ date }: { date?: Date }) {
  return date ? <PageLastUpdate date={date} /> : null;
}

async function Operation({ op, label, anchor, spec, locale, libs, status }: any) {
  const t = translator(locale);
  const p = prefixOf(locale);
  const description = pick(op.description ?? op.summary, locale);
  const { text, pending } = splitPending(description);
  const usage = libs.map((lib: any) => ({ lib, entry: loadUsage(lib.id, spec.id, op.id, locale), fn: status?.libs?.[lib.id]?.functions?.[op.fnId] }));
  const params = Object.fromEntries(op.params.map((x: any) => [x.name, { type: <code>{x.type}</code>, required: !x.optional }]));

  return (
    <section className="scroll-mt-24">
      <h2 id={anchor} className="flex flex-wrap items-baseline gap-x-3">
        {label}
        <code className="text-sm font-normal text-fd-muted-foreground">{op.fnId}</code>
      </h2>

      <Markdown source={'```ts\n' + signature(op) + '\n```'} />

      {/* Status of this function in every library. */}
      <ul className="not-prose flex flex-wrap gap-1.5 !my-4 p-0 list-none">
        {usage.map(({ lib, fn }: any) => (
          <li key={lib.id}>
            <Link
              href={`${p}/libs/${lib.id}/`}
              title={[t(`status.${fn?.status ?? 'missing'}`), fn?.symbol].filter(Boolean).join(' · ')}
              className="inline-flex items-center gap-1.5 rounded-full border bg-fd-card px-2.5 py-1 text-xs hover:bg-fd-accent"
            >
              <StatusIcon status={(fn?.status ?? 'missing') as Status} label={`${t(`status.${fn?.status ?? 'missing'}`)}:`} className="size-3.5" />
              {lib.label}
              {fn?.status === 'failing' && <span className="text-fail">{t('status.failedCases', { count: fn.failed })}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {text.trim() && <Markdown source={text} />}

      {pending.map((note: string, i: number) => (
        <Callout key={i} type="warn" title={L(locale, 'Pending decision', 'Decisão pendente')}>
          <Markdown source={linkFindings(note, locale)} />
        </Callout>
      ))}

      {op.network && <Callout type="info">{t('ops.network')}</Callout>}
      {op.deprecated && <Callout type="warn">{t('ops.deprecated')}</Callout>}

      {op.params.length > 0 && <TypeTable type={params} />}

      <Tabs groupId="lang" persist defaultValue={libs[0].id} className="!my-6">
        <TabsList>
          {usage.map(({ lib }: any) => (
            <TabsTrigger key={lib.id} value={lib.id} className="gap-1.5">
              <LangIcon lib={lib.id} className="size-3.5" />
              {lib.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {usage.map(({ lib, entry, fn }: any) => (
          <TabsContent key={lib.id} value={lib.id}>
            {entry ? (
              <>
                <Markdown source={entry.body} />
                {entry.source && (
                  <a href={entry.source} target="_blank" rel="noopener noreferrer" className="not-prose inline-flex items-center gap-1 text-xs text-fd-muted-foreground hover:text-fd-foreground">
                    {t('usage.source')}: {lib.repo} <ExternalLink className="size-3" />
                  </a>
                )}
              </>
            ) : (
              <p className="text-fd-muted-foreground">
                {isImplemented(fn) ? t('usage.undocumented', { lib: lib.label }) : t('usage.notAvailable', { lib: lib.label })}{' '}
                <Link href={isImplemented(fn) ? `${p}/contributing/usage-files/` : `${p}/contributing/new-language/`}>
                  {isImplemented(fn) ? t('usage.document') : t('usage.contribute')}
                </Link>
              </p>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Accordions type="multiple">
        <TryIt op={op} locale={locale} />
        <Accordion title={<span>{t('cases.summary', { count: op.tests.length })} <code className="font-normal">{op.fnId}</code></span>} id={`${anchor}-cases`}>
          <Cases op={op} locale={locale} libs={libs} status={status} />
        </Accordion>
      </Accordions>
    </section>
  );
}

function Cases({ op, locale, libs, status }: any) {
  const t = translator(locale);
  const ids = testIds(op.fnId, op.tests);
  const withStatus = libs.filter((lib: any) => status?.libs?.[lib.id]);
  const result = (libId: string, caseId: string): [Status, string] => {
    const f = status?.libs?.[libId]?.functions?.[op.fnId];
    if (!f || f.status === 'missing' || f.status === 'waived') return [f?.status === 'waived' ? 'waived' : 'missing', t(`status.${f?.status === 'waived' ? 'waived' : 'missing'}`)];
    const r = f.results?.[caseId];
    if (!r) return ['waived', t('cases.notRun')];
    return [r === 'pass' ? 'ok' : r === 'skip' ? 'waived' : 'failing', t(`cases.${r}`)];
  };
  const show = (v: unknown) => JSON.stringify(v ?? []).slice(1, -1);
  return (
    <div className="overflow-x-auto">
      <table className="!my-0 text-sm">
        <thead>
          <tr>
            <th>{t('testcases.input')}</th>
            <th>{t('testcases.expected')}</th>
            {withStatus.map((lib: any) => (
              <th key={lib.id} className="text-center" title={lib.label}>
                <span className="inline-flex justify-center"><LangIcon lib={lib.id} /></span>
                <span className="sr-only">{lib.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {op.tests.map((test: any, i: number) => (
            <tr key={ids[i]}>
              <td>
                <code>{show(test.args)}</code>
                {test.note && <div className="text-xs text-fd-muted-foreground mt-1">{test.note}</div>}
              </td>
              <td><code>{expectation(test)}</code></td>
              {withStatus.map((lib: any) => {
                const [s, label] = result(lib.id, ids[i]);
                return (
                  <td key={lib.id} className="text-center">
                    <span className="inline-flex justify-center" title={label}><StatusIcon status={s} label={label} /></span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
