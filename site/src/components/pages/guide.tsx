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

export function GuidePage({ locale, lib, slug }: { locale: Locale; lib: string; slug: string }) {
  const entry = guideEntry(lib, slug);
  const guide = entry && loadGuide(lib, slug, locale);
  if (!entry || !guide) notFound();
  const t = translator(locale);
  const library = loadLibs().find((l: any) => l.id === lib);
  const where = functionLinks(locale);
  const uses = entry.fns.flatMap((fn: string) => (where.get(fn) ? [where.get(fn)!] : []));
  const demoText = { demo: t('guide.liveDemo'), demoOf: t('guide.liveDemoOf', { title: '{title}' }), open: t('guide.openDemo') };

  const Files = ({ node }: { node: any }) => {
    const files = node.children.filter((c: any) => c.kind === 'file');
    if (files.length === 1) return <Markdown source={fence(files[0].code, files[0].lang, files[0].name)} />;
    return (
      <FlatTabs items={files.map((f: any) => ({ value: f.name, label: <span className="font-mono text-xs">{f.name}</span>, content: <Markdown source={fence(f.code, f.lang)} /> }))} />
    );
  };

  const Content = ({ node }: { node: any }) => {
    const variants = node.children.filter((c: any) => c.kind === 'variant');
    return (
      <>
        {node.intro && <Markdown source={node.intro} />}
        {variants.length ? (
          <Examples list={variants} group="guide-variant" />
        ) : (
          <>
            {node.demo && <LiveDemo src={/^https?:\/\//.test(node.demo) ? node.demo : `${base}${node.demo}`} title={node.name} text={demoText} />}
            {node.children.length > 0 && <Files node={node} />}
          </>
        )}
      </>
    );
  };

  const Examples = ({ list, group }: { list: any[]; group: string }) => (
    <FlatTabs groupId={group} persist items={list.map((n) => ({ value: n.name ?? '', label: n.name ?? '', content: <Content node={n} /> }))} />
  );

  return (
    <DocsPage tableOfContent={{ enabled: false }}>
      <DocsTitle>{guide.title}</DocsTitle>
      <DocsDescription className="mb-0">{guide.description}</DocsDescription>
      <div className="not-prose flex flex-col gap-3 rounded-xl border bg-fd-card p-4 text-sm">
        <p>
          {t('guide.from', { lib: library?.label ?? lib })}{' '}
          <a href={guide.source} className="underline underline-offset-4">{t('guide.source')}</a>
        </p>
        {uses.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="me-1 text-fd-muted-foreground">{t('guide.uses')}</span>
            {uses.map((u: any) => (
              <Link key={u.href} href={u.href} className="rounded-full border bg-fd-background px-2.5 py-0.5 text-xs hover:bg-fd-accent">
                {u.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      {guide.locale !== locale && <Note type="info">{t('guide.englishOnly')}</Note>}
      <DocsBody>
        {guide.blocks.map((b: any, i: number) => (b.type === 'markdown' ? <Markdown key={i} source={b.text} /> : <Examples key={i} list={b.examples} group="guide-example" />))}
      </DocsBody>
      <EditOnGitHub href={guide.source.replace('/blob/', '/edit/')} />
    </DocsPage>
  );
}

export const guideTitle = (locale: Locale, lib: string, slug: string) => {
  const e = guideEntry(lib, slug);
  return { title: pick(e?.title, locale), description: pick(e?.description, locale) };
};
