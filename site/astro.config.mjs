// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { CATEGORIES, loadSpecs } from './src/lib/registry.mjs';

const SITE_URL = process.env.SITE_URL || 'https://brazilian-utils.com.br';
const BASE_PATH = process.env.BASE_PATH || '/';

// Sidebar entries for every utility that has a spec, grouped by category.
// Adding a utility = adding specs/<id>/ with a meta.yaml. Nothing to edit here.
const specs = loadSpecs();
const utilityGroups = CATEGORIES.map((category) => ({
  label: category.label.en,
  translations: { 'pt-BR': category.label['pt-BR'] },
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
  integrations: [
    starlight({
      title: 'Brazilian Utils',
      description: 'Utilities to validate, format and generate Brazilian data, in every language.',
      logo: { src: './src/assets/icon.png', alt: 'Brazilian Utils' },
      favicon: '/favicon.ico',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        'pt-br': { label: 'Português (Brasil)', lang: 'pt-BR' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/brazilian-utils' },
      ],
      editLink: { baseUrl: 'https://github.com/brazilian-utils/api-validator/edit/main/site/' },
      // Needs git history; the site lives in a git repository now.
      lastUpdated: true,
      customCss: ['./src/styles/brand.css'],
      components: {
        Head: './src/components/Head.astro',
      },
      head: [
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${BASE_PATH.replace(/\/$/, '')}/apple-touch-icon.png` } },
      ],
      sidebar: [
        {
          label: 'Start here',
          translations: { 'pt-BR': 'Comece aqui' },
          items: [
            { slug: 'getting-started', label: 'Getting started', translations: { 'pt-BR': 'Primeiros passos' } },
          ],
        },
        ...utilityGroups,
        {
          label: 'Reference',
          translations: { 'pt-BR': 'Referência' },
          items: [
            { slug: 'reference/parity', label: 'Parity matrix', translations: { 'pt-BR': 'Matriz de paridade' } },
          ],
        },
        {
          label: 'Contributing',
          translations: { 'pt-BR': 'Contribuindo' },
          items: [
            { slug: 'contributing/specs', label: 'Writing a spec', translations: { 'pt-BR': 'Escrevendo uma spec' } },
            { slug: 'contributing/usage-files', label: 'Usage files', translations: { 'pt-BR': 'Arquivos de uso' } },
            { slug: 'contributing/new-language', label: 'Porting to a new language', translations: { 'pt-BR': 'Portando para outra linguagem' } },
          ],
        },
      ],
    }),
  ],
});
