'use client';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { A11yFixes } from './a11y.client';
import dynamic from 'next/dynamic';

// The search engine and its index load when the reader opens the search, not with the page.
const SearchDialog = dynamic(() => import('./search'), { ssr: false });

// Fumadocs' own interface strings, in Portuguese.
const PT: Record<string, string> = {
  'Search(search trigger)': 'Buscar',
  'Search(search dialog)': 'Buscar',
  'No results found(search dialog)': 'Nenhum resultado',
  'On this page(table of contents)': 'Nesta página',
  'No Headings(table of contents)': 'Sem títulos',
  'Next Page(pagination)': 'Próxima',
  'Previous Page(pagination)': 'Anterior',
  'Last updated on(page footer)': 'Atualizado em',
  'Edit on GitHub(edit page)': 'Editar no GitHub',
  'Choose a language(language switcher)': 'Idioma',
  'Choose a language(language switcher)(aria-label)': 'Escolher idioma',
  'Toggle Theme(theme switcher)(aria-label)': 'Alternar tema',
  'Light(theme switcher)(aria-label)': 'Claro',
  'Dark(theme switcher)(aria-label)': 'Escuro',
  'System(theme switcher)(aria-label)': 'Sistema',
  'Copy Text(code block)(aria-label)': 'Copiar código',
  'Copied Text(code block)(aria-label)': 'Copiado',
  'Copy Anchor Link(heading anchor)(aria-label)': 'Copiar link',
  'Open Search(search trigger)(aria-label)': 'Abrir busca',
  'Close Search(search dialog)(aria-label)': 'Fechar busca',
  'Open Sidebar(sidebar)(aria-label)': 'Abrir menu',
  'Close Sidebar(sidebar)(aria-label)': 'Fechar menu',
  'Collapse Sidebar(sidebar)(aria-label)': 'Recolher menu',
  'Toggle Menu(mobile menu)(aria-label)': 'Menu',
  'Parameters(type table)': 'Parâmetros',
  'Returns(type table)': 'Retorno',
  'Type(type table)': 'Tipo',
  'Prop(type table)': 'Nome',
  'Default(type table)': 'Padrão',
  'Page Not Found(404 page)': 'Página não encontrada',
  'Back to Home(404 page)': 'Voltar ao início',
  'Table of Contents(inline table of contents)': 'Sumário',
};

/** The same page in the other language: /pt-br/x/ ↔ /x/. */
const switchPath = (path: string, to: Locale) => {
  const bare = path.replace(/^\/pt-br(?=\/|$)/, '') || '/';
  return to === 'en' ? bare : `/pt-br${bare === '/' ? '/' : bare}`;
};

export function Provider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <RootProvider
      search={{ SearchDialog, preload: false }}
      i18n={{
        locale,
        locales: (Object.keys(LOCALE_NAMES) as Locale[]).map((l) => ({ locale: l, name: LOCALE_NAMES[l] })),
        translations: locale === 'pt-BR' ? PT : undefined,
        onLocaleChange: (v) => {
          try {
            localStorage.setItem('bu:lang', v === 'pt-BR' ? 'pt-br' : 'en'); // an explicit choice wins over the browser
          } catch {}
          router.push(switchPath(pathname, v as Locale));
        },
      }}
    >
      <A11yFixes
        code={locale === 'en' ? 'Code' : 'Código'}
        toc={locale === 'en' ? 'On this page' : 'Nesta página'}
        scroll={locale === 'en' ? 'Scrollable content' : 'Conteúdo com rolagem'}
      />
      {children}
    </RootProvider>
  );
}
