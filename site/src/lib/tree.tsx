// The sidebar: four sections, picked from the switcher at its top (Fumadocs root folders).
import type * as PageTree from 'fumadocs-core/page-tree';
import { BookOpen, Boxes, Compass, GitPullRequest } from 'lucide-react';
import { CATEGORIES, loadGuides, loadLibs, loadSpecs } from './data';
import { type Locale, pick, prefixOf } from './i18n';
import { LangIcon } from '@/components/lang-icon';

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);

export function pageTree(locale: Locale): PageTree.Root {
  const p = prefixOf(locale);
  const specs = loadSpecs();
  const page = (name: React.ReactNode, url: string, icon?: React.ReactNode): PageTree.Item => ({
    type: 'page',
    name,
    // Fumadocs matches pages by URL without the trailing slash; links still get it (trailingSlash).
    url: `${p}${url}`.replace(/\/$/, '') || '/',
    icon,
  });

  const utilities: PageTree.Folder = {
    $id: `${locale}:utilities`,
    type: 'folder',
    root: true,
    name: L(locale, 'Utilities', 'Utilitários'),
    description: L(locale, 'Validate, format and generate', 'Validar, formatar e gerar'),
    icon: <BookOpen />,
    children: [
      page(L(locale, 'Getting started', 'Primeiros passos'), '/getting-started/'),
      ...CATEGORIES.map((c: any) => ({
        $id: `${locale}:cat:${c.id}`,
        type: 'folder' as const,
        name: pick(c.label, locale),
        defaultOpen: false,
        children: specs.filter((s: any) => s.category === c.id).map((s: any) => page(pick(s.title, locale), `/utils/${s.id}/`)),
      })).filter((f) => f.children.length),
    ],
  };

  const libraries: PageTree.Folder = {
    $id: `${locale}:libraries`,
    type: 'folder',
    root: true,
    name: L(locale, 'Libraries', 'Bibliotecas'),
    description: L(locale, 'Seven languages, one contract', 'Sete linguagens, um contrato'),
    icon: <Boxes />,
    children: [
      page(L(locale, 'Parity matrix', 'Matriz de paridade'), '/reference/parity/'),
      { type: 'separator', name: L(locale, 'Libraries', 'Bibliotecas') },
      ...loadLibs().map((lib: any) => page(lib.label, `/libs/${lib.id}/`, <LangIcon lib={lib.id} />)),
    ],
  };

  const guides = loadGuides();
  const guideFolder: PageTree.Folder = {
    $id: `${locale}:guideFolder`,
    type: 'folder',
    root: true,
    name: L(locale, 'Guides', 'Guias'),
    description: L(locale, 'Forms and components, with live demos', 'Formulários e componentes, com demos'),
    icon: <Compass />,
    children: guides.map((g: any) => page(pick(g.title, locale), `/guides/${g.lib}/${g.slug}/`)),
  };

  const contributing: PageTree.Folder = {
    $id: `${locale}:contributing`,
    type: 'folder',
    root: true,
    name: L(locale, 'Contributing', 'Contribuindo'),
    description: L(locale, 'Specs, usage files, new languages', 'Specs, arquivos de uso, novas linguagens'),
    icon: <GitPullRequest />,
    children: [
      page(L(locale, 'Write a spec', 'Escreva uma spec'), '/contributing/specs/'),
      page(L(locale, 'Usage files', 'Arquivos de uso'), '/contributing/usage-files/'),
      page(L(locale, 'Port to a new language', 'Porte para uma nova linguagem'), '/contributing/new-language/'),
    ],
  };

  return { $id: `${locale}:root`, name: 'Brazilian Utils', children: [utilities, libraries, ...(guides.length ? [guideFolder] : []), contributing] };
}
