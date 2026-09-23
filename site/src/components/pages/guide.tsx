// A library guide: its prose, and each group of examples as tabs (framework → variant → file),
// with the live demo above the files. Framework and variant tabs stay in sync across guides.
import Link from '@/components/link';
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle, EditOnGitHub } from 'fumadocs-ui/layouts/notebook/page';
import { Note } from '@/components/note';
import { FlatTabs } from '@/components/flat-tabs';
import { loadGuide, loadGuides, loadLibs } from '@/lib/data';
import { type Locale, pick, translator } from '@/lib/i18n';
import { functionLinks } from '@/lib/links';
import { Markdown } from '@/lib/markdown';
import { LiveDemo } from '@/components/live-demo.client';
import { DocsPager } from '@/components/docs-pager.client';

const base = process.env.NEXT_PUBLIC_BASE ?? '';

/** A fenced code block that survives any backticks in the code. */
function fence(code: string, lang?: string, title?: string) {
  const longest = Math.max(2, ...[...String(code).matchAll(/`+/g)].map((m) => m[0].length));
  const marks = '`'.repeat(longest + 1);
  return `${marks}${lang ?? ''}${title ? ` title=${JSON.stringify(title)}` : ''}\n${String(code).replace(/\n$/, '')}\n${marks}`;
}

export function guideEntry(lib: string, slug: string) {
  return loadGuides().find((g: any) => g.lib === lib && g.slug === slug);
}

type DemoText = { demo: string; demoOf: string; open: string; loading: string };
const demoTextOf = (locale: Locale): DemoText => {
  const t = translator(locale);
  return { demo: t('guide.liveDemo'), demoOf: t('guide.liveDemoOf', { title: '{title}' }), open: t('guide.openDemo'), loading: t('guide.loadingDemo') };
};

function Files({ node }: { node: any }) {
  const files = node.children.filter((c: any) => c.kind === 'file');
  if (!files.length) return null;
  if (files.length === 1) return <Markdown source={fence(files[0].code, files[0].lang, files[0].name)} />;
  return <FlatTabs variant="file" items={files.map((f: any) => ({ value: f.name, label: f.name, content: <Markdown source={fence(f.code, f.lang)} /> }))} />;
}

/** One example of a guide (a framework, a variant): its intro, its live demo and, with `code`, its files. */
function Content({ node, demoText, code }: { node: any; demoText: DemoText; code?: boolean }) {
  const variants = node.children.filter((c: any) => c.kind === 'variant');
  return (
    <>
      {code && node.intro && <Markdown source={node.intro} />}
      {variants.length ? (
        <Examples list={variants} group="guide-variant" demoText={demoText} code={code} />
      ) : (
        <>
          {node.demo && <LiveDemo src={/^https?:\/\//.test(node.demo) ? node.demo : `${base}${node.demo}`} title={node.name} text={demoText} />}
          {code && <Files node={node} />}
        </>
      )}
    </>
  );
}

/** A group of examples as tabs. Framework and variant tabs stay in sync across the site. */
function Examples({ list, group, demoText, code }: { list: any[]; group: string; demoText: DemoText; code?: boolean }) {
  return <FlatTabs groupId={group} persist keepMounted variant={group === 'guide-variant' ? 'compact' : 'line'} items={list.map((n) => ({ value: n.name ?? '', label: n.name ?? '', content: <Content node={n} demoText={demoText} code={code} /> }))} />;
}

/** The first group of examples of a guide (one per framework), or null without the guide. */
export function guideExamples(locale: Locale, lib: string, slug: string): any[] | null {
  const guide = guideEntry(lib, slug) && loadGuide(lib, slug, locale);
  return guide?.blocks.find((b: any) => b.type !== 'markdown')?.examples ?? null;
}

export function GuidePage({ locale, lib, slug }: { locale: Locale; lib: string; slug: string }) {
  const entry = guideEntry(lib, slug);
  const guide = entry && loadGuide(lib, slug, locale);
  if (!entry || !guide) notFound();
  const t = translator(locale);
  const library = loadLibs().find((l: any) => l.id === lib);
  const where = functionLinks(locale);
  const uses = entry.fns.flatMap((fn: string) => (where.get(fn) ? [where.get(fn)!] : []));
  const demoText = demoTextOf(locale);

  return (
    <DocsPage slots={{ footer: DocsPager }} tableOfContent={{ enabled: false }}>
      <DocsTitle>{guide.title}</DocsTitle>
      <DocsDescription className="mb-0">{guide.description}</DocsDescription>
      <div className="not-prose flex flex-col gap-1.5 text-sm text-fd-muted-foreground">
        <p>
          {t('guide.from', { lib: library?.label ?? lib })}{' '}
          <a href={guide.source} className="text-fd-foreground underline underline-offset-4">{t('guide.source')}</a>
        </p>
        {uses.length > 0 && (
          <p>
            {t('guide.uses')}{' '}
            {uses.map((u: any, i: number) => (
              <span key={u.href}>
                {i > 0 && ', '}
                <Link href={u.href} className="text-fd-foreground underline underline-offset-4 hover:text-fd-primary">
                  {u.label}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
      {guide.locale !== locale && <Note type="info">{t('guide.englishOnly')}</Note>}
      <DocsBody>
        {guide.blocks.map((b: any, i: number) => (b.type === 'markdown' ? <Markdown key={i} source={b.text} /> : <Examples key={i} list={b.examples} group="guide-example" demoText={demoText} code />))}
      </DocsBody>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <EditOnGitHub href={guide.source.replace('/blob/', '/edit/')} />
      </div>
    </DocsPage>
  );
}

export const guideTitle = (locale: Locale, lib: string, slug: string) => {
  const e = guideEntry(lib, slug);
  return { title: pick(e?.title, locale), description: pick(e?.description, locale) };
};

/**
 * The guide routes to prerender. A static export needs at least one per dynamic route, so a build
 * without guides (offline, USAGE_SOURCE=fixtures) gets one placeholder that renders the 404 page.
 */
export const guideParams = () => {
  const params = loadGuides().map((g: any) => ({ lib: g.lib, slug: g.slug }));
  return params.length ? params : [{ lib: 'none', slug: 'none' }];
};
