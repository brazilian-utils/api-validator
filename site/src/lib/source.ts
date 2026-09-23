// Hand-written pages (getting started, contributing): content/docs/<page>.mdx in English and
// <page>.pt-br.mdx in Portuguese. Utility, library and guide pages come from the data instead.
import fs from 'node:fs';
import path from 'node:path';
import { loader } from 'fumadocs-core/source';
import { defineI18n } from 'fumadocs-core/i18n';
import { defineDocs } from 'fumadocs-mdx/macro';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import type { Locale } from './i18n';

// File names are kebab-case, so the Portuguese suffix is `pt-br`; the rest of the site says `pt-BR`.
const files = defineI18n({ defaultLanguage: 'en', languages: ['en', 'pt-br'], parser: 'dot' });
/** The site's languages, as the interface and the search index name them. */
export const i18n = defineI18n({ defaultLanguage: 'en', languages: ['en', 'pt-BR'] });
/** The language suffix of a page file (`getting-started.pt-br.mdx`). */
export const fileLocale = (locale: Locale) => (locale === 'pt-BR' ? 'pt-br' : locale);

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    // Same code colors as the rest of the site: high contrast, AA on the code block background.
    mdxOptions: applyMdxPreset({ rehypeCodeOptions: { themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' } } }),
  },
  meta: { schema: metaSchema },
});

export const source = loader({ baseUrl: '/', source: docs.toFumadocsSource(), i18n: files });

/**
 * The hand-written pages of a folder of content/docs, in the order its meta.json lists them
 * (pages it leaves out come last, by title). Adding an .mdx file adds the page, its route, its
 * sidebar entry and its sitemap entry.
 */
export function folderPages(locale: Locale, folder: string) {
  const metaFile = path.join(process.cwd(), 'content', 'docs', folder, 'meta.json');
  const order: string[] = fs.existsSync(metaFile) ? (JSON.parse(fs.readFileSync(metaFile, 'utf8')).pages ?? []) : [];
  const rank = (slug: string) => (order.includes(slug) ? order.indexOf(slug) : order.length);
  return source
    .getPages(fileLocale(locale))
    .filter((p) => p.slugs.length === 2 && p.slugs[0] === folder)
    .map((p) => ({ slug: p.slugs[1], title: p.data.title }))
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.title.localeCompare(b.title));
}
