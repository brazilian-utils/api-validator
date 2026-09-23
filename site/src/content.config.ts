import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
  // Site pages (src/content/docs). Utility pages are generated there by scripts/generate-pages.mjs.
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),

  // UI strings. Built-in Starlight keys plus the custom ones used by our components.
  i18n: defineCollection({
    loader: i18nLoader(),
    schema: i18nSchema({
      extend: z
        .object({
          'util.summary': z.string(),
          'util.implementedIn': z.string(),
          'util.notImplemented': z.string(),
          'util.since': z.string(),
          'util.related': z.string(),
          'spec.fallback': z.string(),
          'spec.missing': z.string(),
          'references.none': z.string(),
          'references.localCopy': z.string(),
          'usage.notAvailable': z.string(),
          'usage.contribute': z.string(),
          'usage.source': z.string(),
          'testcases.none': z.string(),
          'testcases.operation': z.string(),
          'testcases.input': z.string(),
          'testcases.expected': z.string(),
          'testcases.assert': z.string(),
          'parity.utility': z.string(),
          'parity.legend': z.string(),
          'parity.full': z.string(),
          'parity.partial': z.string(),
          'parity.none': z.string(),
          'parity.fetchedAt': z.string(),
        })
        .partial(),
    }),
  }),

  // The canonical specs: specs/<util>/spec.md (pt-BR) and specs/<util>/spec_en.md (en).
  // Entry ids look like "cpf/pt-BR" and "cpf/en".
  specs: defineCollection({
    loader: glob({
      pattern: '*/spec*.md',
      base: './specs',
      generateId: ({ entry }) => {
        const [util, file] = entry.split('/');
        return `${util}/${file === 'spec_en.md' ? 'en' : 'pt-BR'}`;
      },
    }),
    schema: z.object({
      id: z.string().optional(),
      title: z.string().optional(),
      language: z.string().optional(),
      references: z.array(z.string()).optional(),
    }),
  }),

  // Usage snippets downloaded from each library repo by scripts/fetch-usage.mjs.
  // One entry per (lib, util, operation[, locale]).
  usage: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './.cache/usage' }),
    schema: z.object({
      lib: z.string(),
      util: z.string(),
      op: z.string(),
      locale: z.enum(['en', 'pt-BR']).default('en'),
      since: z.string().optional(),
      source: z.string().optional(),
    }),
  }),
};
