// Hand-written pages (getting started, contributing): content/docs/<page>.mdx in English and
// <page>.pt-br.mdx in Portuguese. Utility, library and guide pages come from the data instead.
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
