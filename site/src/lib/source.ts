// Hand-written pages (getting started, contributing): content/docs/<page>.mdx in English and
// <page>.pt-BR.mdx in Portuguese. Utility, library and guide pages come from the data instead.
import { loader } from 'fumadocs-core/source';
import { defineI18n } from 'fumadocs-core/i18n';
import { defineDocs } from 'fumadocs-mdx/macro';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

export const i18n = defineI18n({ defaultLanguage: 'en', languages: ['en', 'pt-BR'], parser: 'dot' });

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    // Same code colors as the rest of the site: high contrast, AA on the code block background.
    mdxOptions: applyMdxPreset({ rehypeCodeOptions: { themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' } } }),
  },
  meta: { schema: metaSchema },
});

export const source = loader({ baseUrl: '/', source: docs.toFumadocsSource(), i18n });
