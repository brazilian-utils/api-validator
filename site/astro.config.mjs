// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightSidebarTopics from 'starlight-sidebar-topics';
import starlightThemeNova from 'starlight-theme-nova';
import { CATEGORIES, REPO_URL, loadGuides, loadLibs, loadSpecs } from './src/lib/registry.mjs';

import baseLinks from './src/integrations/base-links.mjs';

// SITE_URL is the public URL, path included (https://brazilian-utils.github.io/api-validator);
// the path becomes Astro's base unless BASE_PATH says otherwise.
const PUBLIC_URL = new URL(process.env.SITE_URL || 'https://brazilian-utils.com.br');
const SITE_URL = PUBLIC_URL.origin;
const BASE_PATH = process.env.BASE_PATH || `${PUBLIC_URL.pathname.replace(/\/$/, '')}/`;

// Sidebar entries for every utility that has a spec, grouped by category.
// Adding a utility = adding a domain to ../contract (with its category). Nothing to edit here.
const specs = loadSpecs();
const libs = loadLibs();
const guides = loadGuides();
const utilityGroups = CATEGORIES.map((category) => ({
  label: category.label.en,
  translations: { 'pt-BR': category.label['pt-BR'] },
  // Closed until the reader opens it, or is on one of its pages: the menu shows the categories,
  // not all the utilities at once.
  collapsed: true,
  items: specs
    .filter((spec) => spec.category === category.id)
    .map((spec) => ({
      slug: `utils/${spec.id}`,
      label: spec.title.en,
      translations: { 'pt-BR': spec.title['pt-BR'] },
    })),
})).filter((group) => group.items.length > 0);

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  // The try-it box loads the whole reference library (about 600 KB) when a reader opens it. It is
  // the one large chunk, on purpose: a bigger one is a regression the warning should still show.
  vite: { build: { chunkSizeWarningLimit: 650 } },
  integrations: [
    baseLinks(BASE_PATH),
    starlight({
      title: 'Brazilian Utils',
      description: 'Utilities to validate, format and generate Brazilian data, in every language.',
      // The logo sits next to the site name, which says the same: decorative, empty alt.
      logo: { src: './src/assets/icon.png', alt: '' },
      favicon: '/favicon.ico',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        'pt-br': { label: 'Português (Brasil)', lang: 'pt-BR' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/brazilian-utils' },
      ],
      editLink: { baseUrl: `${REPO_URL}/edit/main/site/` },
      // Needs git history; the site lives in a git repository now.
      lastUpdated: true,
      customCss: [
        '@fontsource/archivo/400.css',
        '@fontsource/archivo/500.css',
        '@fontsource/archivo/700.css',
        '@fontsource/atkinson-hyperlegible-mono/400.css',
        '@fontsource/atkinson-hyperlegible-mono/700.css',
        './src/styles/brand.css',
      ],
      components: {
        Head: './src/components/Head.astro',
        Hero: './src/components/Hero.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      head: [
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${BASE_PATH.replace(/\/$/, '')}/apple-touch-icon.png` } },
      ],
      expressiveCode: true,
      plugins: [
        starlightThemeNova(),
        // Three menus instead of one long list: the reader picks what they came for at the top of
        // the sidebar, and only that part of the site is listed under it.
        starlightSidebarTopics(
          [
            {
              label: { en: 'Utilities', 'pt-BR': 'Utilitários' },
              link: '/getting-started/',
              icon: 'open-book',
              items: [
                { slug: 'getting-started', label: 'Getting started', translations: { 'pt-BR': 'Primeiros passos' } },
                ...utilityGroups,
              ],
            },
            ...(guides.length
              ? [
                  {
                    label: { en: 'Guides', 'pt-BR': 'Guias' },
                    link: `/guides/${guides[0].lib}/${guides[0].slug}/`,
                    icon: 'rocket',
                    items: guides.map((g) => ({
                      slug: `guides/${g.lib}/${g.slug}`,
                      label: g.title.en ?? Object.values(g.title)[0],
                      translations: g.title['pt-BR'] ? { 'pt-BR': g.title['pt-BR'] } : {},
                      // Name the library only when guides come from more than one.
                      ...(new Set(guides.map((x) => x.lib)).size > 1 ? { badge: { text: libs.find((l) => l.id === g.lib)?.label ?? g.lib, variant: 'note' } } : {}),
                    })),
                  },
                ]
              : []),
            {
              label: { en: 'Libraries', 'pt-BR': 'Bibliotecas' },
              link: '/reference/parity/',
              icon: 'seti:json',
              items: [
                { slug: 'reference/parity', label: 'Parity matrix', translations: { 'pt-BR': 'Matriz de paridade' } },
                ...libs.map((lib) => ({ slug: `libs/${lib.id}`, label: lib.label })),
              ],
            },
            {
              label: { en: 'Contributing', 'pt-BR': 'Contribuindo' },
              link: '/contributing/specs/',
              icon: 'pencil',
              items: [
                { slug: 'contributing/specs', label: 'Write a spec', translations: { 'pt-BR': 'Escreva uma spec' } },
                { slug: 'contributing/usage-files', label: 'Usage files', translations: { 'pt-BR': 'Arquivos de uso' } },
                { slug: 'contributing/new-language', label: 'Port to a new language', translations: { 'pt-BR': 'Porte para uma nova linguagem' } },
              ],
            },
          ],
          // The home pages belong to no topic.
          { exclude: ['/', '/pt-br/'] },
        ),
      ],
    }),
  ],
});
