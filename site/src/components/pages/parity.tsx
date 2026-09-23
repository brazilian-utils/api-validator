// Utility × library: how many of the utility's functions each library implements, and whether
// they pass the shared cases (with a validator run), else how many its usage files document.
import Link from '@/components/link';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/notebook/page';
import { CATEGORIES, STATUS_MARK, coverage, loadLibs, loadSpecs, loadStatus, loadUsageManifest } from '@/lib/data';
import { type Locale, pick, prefixOf, translator } from '@/lib/i18n';
import { LangIcon } from '@/components/lang-icon';
import { StatusIcon, type Status } from '@/components/status';

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);
export const parityText = (locale: Locale) => ({
  title: L(locale, 'Parity matrix', 'Matriz de paridade'),
  description: L(locale, 'Which library implements which utility, and how much of it, from the last api-validator run.', 'Qual biblioteca implementa qual utilitário, e quanto dele, segundo a última execução do api-validator.'),
});

export function ParityPage({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const p = prefixOf(locale);
  const libs = loadLibs();
  const specs = loadSpecs();
  const status = loadStatus();
  const manifest = loadUsageManifest();
  const groups = CATEGORIES.map((c: any) => ({ c, specs: specs.filter((s: any) => s.category === c.id) })).filter((g: any) => g.specs.length);
  const states = (['full', 'partial', 'failing', 'none'] as const).filter((s) => status || s !== 'failing');
  const { title, description } = parityText(locale);

  return (
    <DocsPage full tableOfContent={{ enabled: false }}>
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>
        <p>
          {L(
            locale,
            'Each cell shows how many functions of the utility the library implements. The icon shows their state. Point to a cell to see each function, or open a library for the details.',
            'Cada célula mostra quantas funções do utilitário a biblioteca implementa. O ícone mostra a situação delas. Aponte para uma célula para ver cada função, ou abra uma biblioteca para os detalhes.',
          )}
        </p>
        <p className="not-prose flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="text-fd-muted-foreground">{t('parity.legend')}:</span>
          {states.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <StatusIcon status={s as Status} /> {t(`parity.${s}`)}
            </span>
          ))}
        </p>
        <div className="not-prose relative overflow-x-auto" tabIndex={0} aria-label={title}>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-fd-card">
              <tr>
                <th scope="col" className="border-b px-3 py-2.5 text-start font-medium text-fd-muted-foreground">{t('parity.utility')}</th>
                {libs.map((lib: any) => (
                  <th key={lib.id} scope="col" className="border-b px-3 py-2.5 text-start font-medium">
                    <Link href={`${p}/libs/${lib.id}/`} className="inline-flex items-center gap-1.5 hover:underline">
                      <LangIcon lib={lib.id} />
                      {lib.label}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(({ c, specs }: any) => [
                <tr key={c.id}>
                  <th colSpan={libs.length + 1} scope="colgroup" className="border-b bg-fd-muted px-3 pt-5 pb-2 text-start text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">
                    {pick(c.label, locale)}
                  </th>
                </tr>,
                ...specs.map((spec: any) => (
                  <tr key={spec.id} className="hover:bg-fd-accent/40">
                    <th scope="row" className="border-b px-3 py-2 text-start font-normal">
                      <Link href={`${p}/utils/${spec.id}/`} className="hover:underline">{pick(spec.title, locale)}</Link>
                    </th>
                    {libs.map((lib: any) => {
                      const x = coverage(spec, lib.id);
                      const detail = x.detail.map((d: any) => `${STATUS_MARK[d.status] ?? '-'} ${pick(d.op.label, locale)}`).join('\n');
                      return (
                        <td key={lib.id} className="border-b px-3 py-2 tabular-nums" title={detail}>
                          <span className="inline-flex items-center gap-1.5">
                            <StatusIcon status={x.state as Status} label={t(`parity.${x.state}`)} />
                            {x.state !== 'none' && <span className="text-xs text-fd-muted-foreground">{x.count}/{x.total}</span>}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-fd-muted-foreground">
          {status
            ? t('parity.fromRun', { date: new Date(status.generatedAt).toLocaleString(locale) })
            : manifest?.fetchedAt
              ? `${t('parity.fetchedAt')} ${new Date(manifest.fetchedAt).toLocaleString(locale)}.`
              : ''}
        </p>
        <p>
          {L(locale, 'To fill an empty cell, read ', 'Para preencher uma célula vazia, leia ')}
          <Link href={`${p}/contributing/new-language/`}>{L(locale, 'port to a new language', 'porte para uma nova linguagem')}</Link>.
        </p>
      </DocsBody>
    </DocsPage>
  );
}
