// Page metadata for search engines and link previews: title, description, canonical URL and the
// same page in the other language (hreflang).
import type { Metadata } from 'next';
import { loadSpec, loadSpecs } from './data';
import { type Locale, pick, prefixOf } from './i18n';

export const SITE = new URL(process.env.SITE_URL || 'https://brazilian-utils.github.io/api-validator');
const base = SITE.pathname.replace(/\/$/, '');
export const SITE_ROOT = `${SITE.origin}${base}`;
const OG_IMAGE = `${SITE_ROOT}/og.png`;

/** Metadata for a page at `path` (without language prefix, starting and ending with /). */
export function pageMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  const url = (l: Locale) => `${SITE.origin}${base}${prefixOf(l)}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url(locale), languages: { en: url('en'), 'pt-BR': url('pt-BR'), 'x-default': url('en') } },
    openGraph: {
      title,
      description,
      url: url(locale),
      siteName: 'Brazilian Utils',
      locale: locale === 'en' ? 'en_US' : 'pt_BR',
      alternateLocale: locale === 'en' ? 'pt_BR' : 'en_US',
      type: 'website',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Brazilian Utils' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE] },
  };
}

export const utilParams = async () => loadSpecs().map((s: any) => ({ id: s.id }));

export function utilMetadata(locale: Locale, id: string): Metadata {
  const spec = loadSpec(id);
  return pageMetadata(locale, `/utils/${id}/`, pick(spec.title, locale), pick(spec.summary, locale));
}

/** Metadata shared by every page of a language: base URL, icons, theme color. */
export function rootMetadata(locale: Locale): Metadata {
  return {
    metadataBase: new URL(`${SITE_ROOT}/`),
    title: { template: '%s · Brazilian Utils', default: 'Brazilian Utils' },
    applicationName: 'Brazilian Utils',
    icons: { icon: `${base}/favicon.ico`, apple: `${base}/apple-touch-icon.png` },
    openGraph: { siteName: 'Brazilian Utils', locale: locale === 'en' ? 'en_US' : 'pt_BR' },
  };
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f0e5' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1b1a' },
  ],
};
