import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import logo from '@/assets/logo.png';
import { siGithub } from 'simple-icons';
import { type Locale, prefixOf } from './i18n';
import { loadGuides } from './data';
import { folderPages } from './source';
import type { Section } from '@/components/site-header.client';

/** The brand logo, the dog and the wordmark (header, 404 page), from brazilian-utils/brand. */
export function SiteMark({ className = 'h-11' }: { className?: string }) {
  return <Image src={logo} alt="Brazilian Utils" height={96} className={`site-logo w-auto ${className}`} priority />;
}

export function baseOptions(locale: Locale): BaseLayoutProps {
  return {
    nav: {
      title: <SiteMark />,
      url: `${prefixOf(locale)}/`,
    },
    // An icon link with a name (Fumadocs' githubUrl draws an unnamed role="img" svg).
    links: [
      {
        type: 'icon',
        label: 'GitHub',
        text: 'GitHub',
        url: 'https://github.com/brazilian-utils',
        external: true,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d={siGithub.path} />
          </svg>
        ),
      },
    ],
    i18n: true,
  };
}

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);

const githubIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className="size-4.5">
    <path d={siGithub.path} />
  </svg>
);

/** The sections of the documentation, in the header of every page (the sidebar's root folders). */
export function siteSections(locale: Locale): Section[] {
  const p = prefixOf(locale);
  const guide = loadGuides()[0];
  const first = (folder: string) => folderPages(locale, folder)[0]?.slug;
  return [
    { title: L(locale, 'Utilities', 'Utilitários'), url: `${p}/getting-started/`, match: ['/getting-started', '/utils/'] },
    { title: L(locale, 'Libraries', 'Bibliotecas'), url: `${p}/reference/parity/`, match: ['/reference/', '/libs/'] },
    ...(guide ? [{ title: L(locale, 'Guides', 'Guias'), url: `${p}/guides/${guide.lib}/${guide.slug}/`, match: ['/guides/'] }] : []),
    { title: L(locale, 'Contributing', 'Como contribuir'), url: `${p}/contributing/${first('contributing')}/`, match: ['/contributing/'] },
    ...(first('about') ? [{ title: L(locale, 'About', 'Sobre'), url: `${p}/about/${first('about')}/`, match: ['/about/'] }] : []),
  ];
}

/** What the shared header needs (site-header.client.tsx). */
export function headerProps(locale: Locale) {
  return {
    sections: siteSections(locale),
    title: <SiteMark />,
    homeUrl: `${prefixOf(locale)}/`,
    prefix: prefixOf(locale),
    github: { url: 'https://github.com/brazilian-utils', label: 'GitHub', icon: githubIcon },
    menuLabel: L(locale, 'Menu', 'Menu'),
    sectionsLabel: L(locale, 'Sections', 'Seções'),
    skipLabel: L(locale, 'Skip to content', 'Pular para o conteúdo'),
  };
}
