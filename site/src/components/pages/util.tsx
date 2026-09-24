// A utility page (CPF, CEP, license plate…): what it is, which library has what, then one block
// per contract function (signature, parameters, usage in every language, try it, shared cases),
// then the long-form spec and the official sources.
import fs from 'node:fs';
import path from 'node:path';
import Link from '@/components/link';
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle, PageLastUpdate } from 'fumadocs-ui/layouts/notebook/page';
import { lastCommit } from '@/lib/git';
import { Note } from '@/components/note';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { ArrowRight, ExternalLink, FileJson, Pencil } from 'lucide-react';
import { Breakdown } from '@/components/breakdown.client';
import { functionBreakdown } from '@/lib/breakdown';
import { CONTRACT_DIR, REPO_URL, contractPath, specName, expectation, isImplemented, loadGuides, loadLibs, loadReferenceFiles, loadReferences, loadSpec, loadStatus, testIds } from '@/lib/data';
import { type Locale, pick, prefixOf, translator } from '@/lib/i18n';
import { Markdown } from '@/lib/markdown';
import { demote, linkFindings, slug, splitPending } from '@/lib/prose';
import { loadUsage, sinceOf } from '@/lib/usage';
import { LangIcon } from '@/components/lang-icon';
import { StatusIcon, type Status } from '@/components/status';
import { TryIt } from '@/components/try-it';
import { FlatTabs } from '@/components/flat-tabs';
import { Disclosure } from '@/components/disclosure';
import { DocsPager } from '@/components/docs-pager.client';

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);

// A reference with no title in references.md: hostname and the first two path segments, not the full URL.
function linkLabel(r: { title: string; url: string }) {
  if (r.title !== r.url.replace(/^https?:\/\//, '').replace(/\/$/, '')) return r.title;
  try {
    const u = new URL(r.url);
    const parts = u.pathname.split('/').filter(Boolean);
    const shown = parts.slice(0, 2).map((x) => decodeURIComponent(x));
    // Past two segments, the last one too, so two documents from the same folder stay apart.
    if (parts.length > 2) shown.push('…', decodeURIComponent(parts[parts.length - 1]));
    return [u.hostname.replace(/^www\./, ''), ...shown].join('/');
  } catch {
    return r.title;
  }
}

export async function UtilPage({ locale, id }: { locale: Locale; id: string }) {
  const spec = loadSpec(id);
  if (!spec) notFound();
  const t = translator(locale);
  const p = prefixOf(locale);
  const libs = loadLibs();
  const status = loadStatus();
  const guides = loadGuides().filter((g: any) => g.fns.some((fn: string) => spec.operations.some((op: any) => op.fnId === fn)));
  const related = spec.related.map((r: string) => loadSpec(r)).filter(Boolean);
  const specFile = path.join(CONTRACT_DIR, spec.id, specName(locale));
  const other = path.join(CONTRACT_DIR, spec.id, specName(locale === 'en' ? 'pt-BR' : 'en'));
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
    <DocsPage slots={{ footer: DocsPager }} toc={toc} tableOfContent={{ style: 'clerk' }} breadcrumb={{ enabled: false }}>
      <DocsTitle>{pick(spec.title, locale)}</DocsTitle>
      <DocsDescription className="mb-0">{pick(spec.summary, locale)}</DocsDescription>

      <div className="flex flex-wrap gap-2 not-prose">
        <a className={buttonVariants({ color: 'secondary', size: 'sm', className: 'gap-1.5' })} href={`${REPO_URL}/blob/main/${contractPath(spec)}/contract.json`} target="_blank" rel="noopener noreferrer">
          <FileJson className="size-3.5" /> {L(locale, 'Contract', 'Contrato')}
        </a>
        <a className={buttonVariants({ color: 'secondary', size: 'sm', className: 'gap-1.5' })} href={`${REPO_URL}/edit/main/${contractPath(spec)}/contract.json`} target="_blank" rel="noopener noreferrer">
          <Pencil className="size-3.5" /> {L(locale, 'Edit on GitHub', 'Editar no GitHub')}
        </a>
      </div>

      {/* How much of this utility each library implements: what is missing, in words; the list of
          functions on hover or click. */}
      <ul className="not-prose flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {libs.map((lib: any) => {
          const b = functionBreakdown(spec, lib.id, locale);
          const since = sinceOf(lib.id, spec.id);
          return (
            <li key={lib.id}>
              <Breakdown
                title={t('cov.inLib', { util: pick(spec.title, locale), lib: lib.label })}
                items={b.items}
                label={`${lib.label} ${b.short}`}
                href={`${p}/libs/${lib.id}/`}
                hrefText={t('cov.openLib', { lib: lib.label })}
              >
                <LangIcon lib={lib.id} className="size-4" />
                <span className="font-medium">{lib.label}</span>
                <StatusIcon status={b.state} className="size-3.5" />
                <span className="text-fd-muted-foreground underline decoration-dotted underline-offset-4">{b.short}</span>
                {since && <span className="text-fd-muted-foreground">{t('util.since', { version: since })}</span>}
              </Breakdown>
            </li>
          );
        })}
        <li>
          <Link href={`${p}/reference/parity/`} className="inline-flex items-center gap-1.5 text-fd-muted-foreground hover:text-fd-foreground">
            {L(locale, 'Parity matrix', 'Matriz de paridade')}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </li>
      </ul>

      <DocsBody>
        {englishOnly && <p className="text-sm text-fd-muted-foreground">{t('ops.englishOnly')}</p>}
        {ops.map(({ op, label, anchor }) => (
          <Operation key={op.fnId} op={op} label={label} anchor={anchor} spec={spec} locale={locale} libs={libs} status={status} />
        ))}

        {guides.length > 0 && (
          <>
            <h2 id="guides">{t('util.guides')}</h2>
            {/* Rows between rules, like the home page's lists: a guide is a link and a sentence. */}
            <ul className="not-prose divide-y border-y">
              {guides.map((g: any) => (
                <li key={g.slug}>
                  <Link href={`${p}/guides/${g.lib}/${g.slug}/`} className="group flex items-start justify-between gap-4 py-3">
                    <span>
                      <span className="font-medium group-hover:text-fd-primary">{pick(g.title, locale)}</span>
                      <span className="mt-0.5 block text-sm text-fd-muted-foreground">{pick(g.description, locale)}</span>
                    </span>
                    <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-fd-muted-foreground group-hover:text-fd-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {longSpec && (
          <>
            <h2 id="specification">{L(locale, 'Specification', 'Especificação')}</h2>
            {specIsFallback && <Note type="warn">{t('spec.fallback')}</Note>}
            <Markdown source={demote(longSpec)} />
          </>
        )}

        <h2 id="official-sources">{L(locale, 'Official sources', 'Fontes oficiais')}</h2>
        {references.length === 0 && localCopies.length === 0 && <p>{t('references.none')}</p>}
        {references.length > 0 && (
          <ul className="[overflow-wrap:anywhere]">
            {references.map((r: any) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {linkLabel(r)}
                </a>
              </li>
            ))}
          </ul>
        )}
        {localCopies.length > 0 && (
          <Disclosure title={`${t('references.localCopy')} (${localCopies.length})`} id="local-copies">
              <ul>
                {localCopies.map((f: any) => (
                  <li key={f.name}>
                    <a href={`${REPO_URL}/blob/main/${encodeURI(f.repoPath)}`} target="_blank" rel="noopener noreferrer">
                      {f.name}
                    </a>
                  </li>
                ))}
              </ul>
          </Disclosure>
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
      <LastUpdate date={lastCommit(contractPath(spec))} />
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

  return (
    <section className="scroll-mt-24">
      {/* The name alone: the contract id and a typed signature would read as code to copy, and each
          language shows its own call in the tabs below. */}
      <h2 id={anchor}>{label}</h2>

      {/* Status of this function in every library. */}
      <ul className="not-prose flex flex-wrap gap-x-4 gap-y-1 !my-4 p-0 list-none">
        {usage.map(({ lib, fn }: any) => (
          <li key={lib.id}>
            <Link
              href={`${p}/libs/${lib.id}/`}
              title={[t(`status.${fn?.status ?? 'missing'}`), fn?.symbol].filter(Boolean).join(' · ')}
              className="inline-flex items-center gap-1 text-xs text-fd-muted-foreground hover:text-fd-foreground"
            >
              <StatusIcon status={(fn?.status ?? 'missing') as Status} label={t(`status.${fn?.status ?? 'missing'}`)} className="size-3.5" />
              {lib.label}
              <span className="sr-only">{t('cov.libraryWord')}</span>
              {fn?.status === 'failing' && <span className="text-fail">{t('status.failedCases', { count: fn.failed })}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {text.trim() && <Markdown source={text} />}

      {pending.map((note: string, i: number) => (
        <Note key={i} type="warn" title={L(locale, 'Pending decision', 'Decisão pendente')}>
          <Markdown source={linkFindings(note, locale)} />
        </Note>
      ))}

      {op.network && <Note type="info">{t('ops.network')}</Note>}
      {op.deprecated && <Note type="warn">{t('ops.deprecated')}</Note>}

      {/* The signature already says it all unless there is more than one parameter or an optional one. */}
      {showParams(op) && (
        <table>
          <thead>
            <tr>
              <th scope="col">{L(locale, 'Parameter', 'Parâmetro')}</th>
              <th scope="col">{L(locale, 'Type', 'Tipo')}</th>
              <th scope="col">{L(locale, 'Required', 'Obrigatório')}</th>
            </tr>
          </thead>
          <tbody>
            {op.params.map((x: any) => (
              <tr key={x.name}>
                <td><code>{x.name}</code></td>
                <td><code>{x.type}</code></td>
                <td>{x.optional ? L(locale, 'no', 'não') : L(locale, 'yes', 'sim')}</td>
              </tr>
            ))}
            <tr>
              <td className="text-fd-muted-foreground">{L(locale, 'returns', 'retorna')}</td>
              <td><code>{op.returns}</code></td>
              <td />
            </tr>
          </tbody>
        </table>
      )}

      <FlatTabs
        groupId="lang"
        persist
        label={L(locale, 'Library', 'Biblioteca')}
        items={usage.map(({ lib, entry, fn }: any) => ({
          value: lib.id,
          label: (
            <>
              <LangIcon lib={lib.id} className="size-3.5" />
              {lib.label}
            </>
          ),
          content: entry ? (
            <>
              <Markdown source={entry.body} />
              {entry.source && (
                <a href={entry.source} target="_blank" rel="noopener noreferrer" className="not-prose mt-2 inline-flex items-center gap-1 text-xs text-fd-muted-foreground no-underline hover:text-fd-foreground">
                  {t('usage.code')}: {lib.repo} <ExternalLink className="size-3" />
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
          ),
        }))}
      />

      <div className="my-6">
        <TryIt op={op} locale={locale} />
        <Disclosure title={<span>{t('cases.summary', { count: op.tests.length })} <code className="font-normal">{op.fnId}</code></span>} id={`${anchor}-cases`}>
          <Cases op={op} locale={locale} libs={libs} status={status} />
        </Disclosure>
      </div>
    </section>
  );
}

function showParams(op: any) {
  const params: any[] = op.params ?? [];
  return params.length > 1 || params.some((x) => x.optional || x.description || x.default !== undefined || x.enum || x.allowed);
}

function Cases({ op, locale, libs, status }: any) {
  const t = translator(locale);
  if (!op.tests?.length) return <p className="text-sm text-fd-muted-foreground">{t('testcases.none')}</p>;
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
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th scope="col" className="px-2 py-1.5 text-start font-medium">{t('testcases.input')}</th>
            <th scope="col" className="px-2 py-1.5 text-start font-medium">{t('testcases.expected')}</th>
            {withStatus.map((lib: any) => (
              <th key={lib.id} scope="col" className="w-8 px-2 py-1.5 text-center font-medium" title={lib.label}>
                <span role="img" aria-label={lib.label} className="inline-flex justify-center"><LangIcon lib={lib.id} /></span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {op.tests.map((test: any, i: number) => (
            <tr key={ids[i]} className="border-b">
              <td className="px-2 py-1.5 text-start align-top">
                <code className="whitespace-nowrap">{show(test.args)}</code>
                {test.note && <div className="mt-1 min-w-40 text-xs text-fd-muted-foreground">{test.note}</div>}
              </td>
              <td className="px-2 py-1.5 text-start align-top"><code className="whitespace-nowrap">{expectation(test)}</code></td>
              {withStatus.map((lib: any) => {
                const [s, label] = result(lib.id, ids[i]);
                return (
                  <td key={lib.id} className="w-8 px-2 py-1.5 text-center align-top">
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
