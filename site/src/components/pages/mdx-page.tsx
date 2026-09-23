// A hand-written page (content/docs/*.mdx).
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle, EditOnGitHub, PageLastUpdate } from 'fumadocs-ui/layouts/notebook/page';
import { lastCommit } from '@/lib/git';
import { fileLocale, source } from '@/lib/source';
import { REPO_URL } from '@/lib/data';
import { getMDXComponents } from '@/components/mdx';
import { pageMetadata } from '@/lib/meta';
import type { Locale } from '@/lib/i18n';
import { DocsPager } from '@/components/docs-pager.client';

const pageOf = (locale: Locale, slugs: string[]) => source.getPage(slugs, fileLocale(locale)) ?? notFound();

export function MdxPage({ locale, slugs }: { locale: Locale; slugs: string[] }) {
  const page = pageOf(locale, slugs);
  const MDX = page.data.body;
  return (
    <DocsPage slots={{ footer: DocsPager }} toc={page.data.toc} tableOfContent={{ style: 'clerk' }}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <EditOnGitHub href={`${REPO_URL}/edit/main/site/content/docs/${page.path}`} />
        <LastUpdate date={lastCommit(`site/content/docs/${page.path}`)} />
      </div>
    </DocsPage>
  );
}

export function mdxMetadata(locale: Locale, slugs: string[]) {
  const page = pageOf(locale, slugs);
  return pageMetadata(locale, `/${slugs.join('/')}/`, page.data.title, page.data.description ?? '');
}

function LastUpdate({ date }: { date?: Date }) {
  return date ? <PageLastUpdate date={date} /> : null;
}
