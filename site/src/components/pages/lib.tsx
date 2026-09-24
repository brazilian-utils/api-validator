// A library's page: its package, how it compares, what to do next (failing first, then wrong
// signatures, then missing core, then the rest, each ordered by how many libraries already have
// it), the failing cases, functions without a usage example, public API outside the contract.
import fs from 'node:fs';
import path from 'node:path';
import Link from '@/components/link';
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/notebook/page';
import { Note } from '@/components/note';
import { Disclosure } from '@/components/disclosure';
import { isImplemented, loadLibs, loadStatus, loadUsageManifest } from '@/lib/data';
import { type Locale, prefixOf, translator } from '@/lib/i18n';
import { functionLinks } from '@/lib/links';
import { Markdown } from '@/lib/markdown';
import { SITE_ROOT } from '@/lib/meta';
import { demoteHeadings } from '@/lib/prose';
import { LangIcon } from '@/components/lang-icon';
import { StatusIcon, type Status } from '@/components/status';
import { DocsPager } from '@/components/docs-pager.client';
import { InstallOptions, Runtimes } from '@/components/install-options';

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);
export const libTitle = (locale: Locale, label: string) => L(locale, `${label} library`, `Biblioteca ${label}`);
export const libDescription = (locale: Locale, label: string) =>
  L(locale, `What the ${label} library implements from the shared contract, what fails, and what to do next.`, `O que a biblioteca ${label} implementa do contrato compartilhado, o que falha e o que fazer agora.`);

const base = process.env.NEXT_PUBLIC_BASE ?? '';
const show = (v: unknown) => (v === undefined || v === null ? 'null' : JSON.stringify(v));
/** Past this many rows a table starts closed, so the page stays a page. */
const LONG = 15;
const GROUPS = ['failing', 'signature', 'missing'] as const;

export async function LibPage({ locale, id }: { locale: Locale; id: string }) {
  const libs = loadLibs();
  const lib = libs.find((l: any) => l.id === id);
  if (!lib) notFound();
  const t = translator(locale);
  const p = prefixOf(locale);
  const status = loadStatus();
  const mine = status?.libs?.[id];
  const where = functionLinks(locale);
  const implementedBy = (fnId: string) => libs.filter((o: any) => o.id !== id && isImplemented(status?.libs?.[o.id]?.functions?.[fnId])).map((o: any) => o.label);
  const rank = (f: any) => ({ failing: 0, signature: 1, missing: f.level === 'core' ? 2 : 3 } as Record<string, number>)[f.status] ?? 9;
  const fns = Object.entries((mine?.functions ?? {}) as Record<string, any>);
  const work = fns
    .filter(([, f]) => rank(f) < 9)
    .map(([fnId, f]) => ({ fnId, f, by: implementedBy(fnId) }))
    .sort((a, b) => rank(a.f) - rank(b.f) || b.by.length - a.by.length || a.fnId.localeCompare(b.fnId));
  const groups = GROUPS.map((g) => ({ g, rows: work.filter((w) => w.f.status === g) })).filter((x) => x.rows.length);
  const failures = fns.flatMap(([fnId, f]) => (f.failures ?? []).map((x: any) => ({ fn: fnId, ...x })));
  const undocumented = fns.filter(([, f]) => isImplemented(f) && f.usage && !f.usage.documented);
  const others = status ? libs.filter((l: any) => status.libs[l.id]).sort((a: any, b: any) => status.libs[b.id].summary.coreCoverage - status.libs[a.id].summary.coreCoverage) : [];
  const s = mine?.summary;
  const intro = loadUsageManifest()?.libs?.[id]?.intro ?? {};
  const conventions = intro[locale] ?? intro.en;

  const toc = [
    { title: t('libs.install'), url: '#install', depth: 2 },
    ...(lib.runtimes.length ? [{ title: t('libs.runtimes'), url: '#runtimes', depth: 3 }] : []),
    ...(mine ? [{ title: t('lib.compare'), url: '#compare', depth: 2 }, { title: t('lib.work'), url: '#work', depth: 2 }] : []),
    ...(mine ? groups.map(({ g, rows }) => ({ title: t(`lib.group.${g}`, { count: rows.length }), url: `#work-${g}`, depth: 3 })) : []),
    ...(failures.length ? [{ title: t('lib.failures'), url: '#failures', depth: 2 }] : []),
    ...(undocumented.length ? [{ title: t('lib.undocumented'), url: '#undocumented', depth: 2 }] : []),
    ...(mine?.unmapped?.length ? [{ title: t('lib.outsideTitle'), url: '#outside', depth: 2 }] : []),
    ...(conventions ? [{ title: L(locale, 'API conventions', 'Convenções da API'), url: '#conventions', depth: 2 }] : []),
    ...(mine ? [{ title: t('lib.badgeTitle'), url: '#badge', depth: 2 }] : []),
  ];
  const failureTable = (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('lib.case')}</th>
          <th scope="col">{t('testcases.expected')}</th>
          <th scope="col">{t('lib.actual')}</th>
        </tr>
      </thead>
      <tbody>
        {failures.map((x: any, i: number) => (
          <tr key={`${x.id}-${i}`}>
            <td><Link href={where.get(x.fn)?.href ?? '#'}><code className="whitespace-nowrap!">{x.id}</code></Link></td>
            <td><code>{show(x.expected)}</code></td>
            <td><code>{x.actual === null && x.message ? x.message : show(x.actual)}</code></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const badgeAlt = s ? t('lib.badgeAlt', { core: s.coreCoverage, passed: s.testsPassed }) : '';
  // The badge's own width, so the page reserves its room before the image arrives.
  const badgeFile = path.join(process.cwd(), 'public', 'badges', `${lib.id}.svg`);
  const badgeWidth = fs.existsSync(badgeFile) ? Number(/width="(\d+)"/.exec(fs.readFileSync(badgeFile, 'utf8'))?.[1]) || undefined : undefined;
  const badgeMarkdown = `[![${t('lib.badgeLabel')}](${SITE_ROOT}/badges/${lib.id}.svg)](${SITE_ROOT}/libs/${lib.id}/)`;

  return (
    <DocsPage slots={{ footer: DocsPager }} toc={toc} tableOfContent={{ style: 'clerk' }}>
      <DocsTitle className="flex items-center gap-3">
        <LangIcon lib={lib.id} className="size-7" />
        {libTitle(locale, lib.label)}
      </DocsTitle>
      <DocsDescription className="mb-0">{libDescription(locale, lib.label)}</DocsDescription>

      <dl className="not-prose grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y py-3 text-sm">
        <dt className="text-fd-muted-foreground">{t('lib.repository')}</dt>
        <dd className="min-w-0 break-words">
          <a href={`https://github.com/${lib.repo}`} className="underline underline-offset-4">github.com/{lib.repo}</a>
          {mine?.revision && <code className="ms-2 text-xs text-fd-muted-foreground">{mine.revision.slice(0, 7)}</code>}
        </dd>
        <dt className="text-fd-muted-foreground">{t('lib.package')}</dt>
        <dd><a href={lib.registry} className="underline underline-offset-4">{lib.package}</a></dd>
      </dl>

      <DocsBody>
        <h2 id="install">{t('libs.install')}</h2>
        <InstallOptions options={lib.installs} locale={locale} label={t('libs.installs')} />
        {lib.runtimes.length > 0 && (
          <>
            <h3 id="runtimes">{t('libs.runtimes')}</h3>
            <Runtimes runtimes={lib.runtimes} locale={locale} />
          </>
        )}
        {!mine ? (
          <>
            <Note type="info">{t('lib.noStatus')}</Note>
            {/* A build without a run (a preview, a fresh clone): say what the run adds and where to look meanwhile. */}
            <p>
              {locale === 'en'
                ? `Each night the docs run reads the ${lib.label} library's public API, binds it to the shared contract and runs the shared test cases. This page then shows which functions the library implements, which cases fail, and what to do next.`
                : `Toda noite, a execução do docs lê a API pública da biblioteca ${lib.label}, liga cada função ao contrato compartilhado e roda os casos de teste compartilhados. Esta página passa então a mostrar quais funções a biblioteca implementa, quais casos falham e o que fazer em seguida.`}
            </p>
            <p>
              {locale === 'en' ? 'Meanwhile, the ' : 'Enquanto isso, a '}
              <Link href={`${p}/reference/parity/`}>{locale === 'en' ? 'parity matrix' : 'matriz de paridade'}</Link>
              {locale === 'en' ? ' compares every library, and ' : ' compara todas as bibliotecas, e '}
              <Link href={`${p}/contributing/pipeline/`}>{locale === 'en' ? 'How the pipeline works' : 'Como funciona o pipeline'}</Link>
              {locale === 'en' ? ' explains when the run happens and what it writes.' : ' explica quando a execução acontece e o que ela escreve.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-lg">
              {t('lib.summary', { lib: lib.label, done: s.ok + s.failing, total: s.total, core: s.coreCoverage })}{' '}
              {t('lib.summaryCases', { passed: s.testsPassed, failed: s.testsFailed })} {s.signature > 0 && t('lib.summarySignatures', { count: s.signature })}{' '}
              {mine.unmapped.length > 0 && t('lib.summaryOutside', { count: mine.unmapped.length })}
            </p>

            <h2 id="compare">{t('lib.compare')}</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('lib.library')}</th>
                  <th scope="col">{t('lib.core')}</th>
                  <th scope="col">{t('lib.implemented')}</th>
                  <th scope="col">{t('lib.passing')}</th>
                </tr>
              </thead>
              <tbody>
                {others.map((o: any) => {
                  const os = status.libs[o.id].summary;
                  const me = o.id === id;
                  return (
                    <tr key={o.id} className={me ? 'bg-fd-primary/10 font-semibold' : undefined}>
                      <th scope="row" className="font-normal">
                        <span className="inline-flex items-center gap-2">
                          <LangIcon lib={o.id} />
                          {me ? (
                            <span className="font-semibold">{o.label}</span>
                          ) : (
                            <Link href={`${p}/libs/${o.id}/`}>
                              {o.label}
                              <span className="sr-only">{t('cov.libraryWord')}</span>
                            </Link>
                          )}
                        </span>
                      </th>
                      <td>
                        {/* A data bar, no track: its length is the share, the number says it. */}
                        <span className="flex items-center gap-3 tabular-nums">
                          <span className="w-12 text-right">{os.coreCoverage}%</span>
                          <span className="block h-2 max-w-20 rounded-sm bg-fd-primary/70" style={{ width: `${(os.coreCoverage / 100) * 5}rem` }} aria-hidden />
                        </span>
                      </td>
                      <td className="tabular-nums">{os.ok + os.failing}/{os.total}</td>
                      <td className="tabular-nums">{os.testsPassed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h2 id="work">{t('lib.work')}</h2>
            <p>{t('lib.workIntro')}</p>
            {work.length === 0 ? (
              <p>{t('lib.workDone')}</p>
            ) : (
              groups.map(({ g, rows }) => {
                // Missing functions rarely have anything to say: the column appears only when a row does.
                const details = rows.some(({ f }) => f.status !== 'missing' || f.suggestions?.length);
                const table = (
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{t('lib.function')}</th>
                        <th scope="col">{t('lib.status')}</th>
                        {details && <th scope="col">{t('lib.why')}</th>}
                        <th scope="col">{t('lib.implementedBy')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ fnId, f, by }) => (
                        <tr key={fnId}>
                          <td>
                            <Link href={where.get(fnId)?.href ?? '#'}>{where.get(fnId)?.label ?? fnId}</Link>
                            {/* The contract id under the name, when the name is not already the id. */}
                            {(where.get(fnId)?.label || f.level === 'core') && (
                              <div className="text-xs text-fd-muted-foreground">
                                {where.get(fnId)?.label && <code className="whitespace-nowrap!">{fnId}</code>}
                                {f.level === 'core' && ` ${t('lib.coreTag')}`}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={t(`status.${f.status}`)}>
                              <StatusIcon status={f.status as Status} />
                              {t(`status.short.${f.status}`)}
                            </span>
                          </td>
                          {details && (
                            <td className="text-sm">
                              {f.status === 'failing'
                                ? t('status.failedCases', { count: f.failed })
                                : f.status === 'signature'
                                  ? f.issues.join('. ')
                                  : f.suggestions?.length
                                    ? t('lib.maybe', { symbols: f.suggestions.join(', ') })
                                    : ''}
                            </td>
                          )}
                          <td className="text-sm">{by.length ? `${by.length}: ${by.join(', ')}` : t('lib.nobody')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
                return (
                  <section key={g}>
                    <h3 id={`work-${g}`}>{t(`lib.group.${g}`, { count: rows.length })}</h3>
                    {rows.length > LONG ? <Disclosure title={t(`lib.show.${g}`, { count: rows.length })}>{table}</Disclosure> : table}
                  </section>
                );
              })
            )}

            {failures.length > 0 && (
              <>
                <h2 id="failures">{t('lib.failures')}</h2>
                {failures.length > LONG ? <Disclosure title={t('lib.show.cases', { count: failures.length })}>{failureTable}</Disclosure> : failureTable}
              </>
            )}

            {undocumented.length > 0 && (
              <>
                <h2 id="undocumented">{t('lib.undocumented')}</h2>
                <p>{t('lib.undocumentedIntro')}</p>
                <ul>
                  {undocumented.map(([fnId]) => (
                    <li key={fnId}>
                      <Link href={where.get(fnId)?.href ?? '#'}>{where.get(fnId)?.label ?? fnId}</Link> <code>{fnId}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {mine.unmapped.length > 0 && (
              <>
                <h2 id="outside">{t('lib.outsideTitle')}</h2>
                <p>{t('lib.outsideIntro')}</p>
                <ul>
                  {mine.unmapped.map((u: any) => (
                    <li key={u.symbol}>
                      <code>{u.symbol}</code>
                      {u.suggestions.length > 0 && <span className="text-fd-muted-foreground"> {t('lib.maybe', { symbols: u.suggestions.join(', ') })}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {conventions && (
          <>
            <h2 id="conventions">{L(locale, 'API conventions', 'Convenções da API')}</h2>
            <Markdown source={demoteHeadings(conventions)} />
          </>
        )}

        {mine && (
          <>
            <h2 id="badge">{t('lib.badgeTitle')}</h2>
            <p>{t('lib.badgeIntro')}</p>
            <p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${base}/badges/${lib.id}.svg`} alt={badgeAlt} width={badgeWidth} height={20} />
            </p>
            <Markdown source={'```md\n' + badgeMarkdown + '\n```'} />
          </>
        )}
      </DocsBody>
    </DocsPage>
  );
}
