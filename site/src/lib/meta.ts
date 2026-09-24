// Page metadata for search engines and link previews: title, description, canonical URL and the
// same page in the other language (hreflang).
import type { Metadata } from 'next';
import { loadSpec, loadSpecs } from './data';
import { type Locale, pick, prefixOf } from './i18n';

export const SITE = new URL(process.env.SITE_URL || 'https://brazilian-utils.github.io/doc');
const base = SITE.pathname.replace(/\/$/, '');
export const SITE_ROOT = `${SITE.origin}${base}`;
const OG_IMAGE = `${SITE_ROOT}/og.png`;
/** Where this build is served from (Vercel serves at the domain root, GitHub Pages under a path). */
const servedBase = process.env.NEXT_PUBLIC_BASE ?? '';

/**
 * A build that is not the canonical site: every Vercel deployment (review links). Its pages, files
 * and headers all say noindex (vercel.json adds X-Robots-Tag), and canonical links point at
 * SITE_URL. SITE_INDEXABLE=true lifts it, for the day Vercel serves the canonical site.
 */
export const NOINDEX = Boolean(process.env.VERCEL) && process.env.SITE_INDEXABLE !== 'true';

/** Metadata for a page at `path` (without language prefix, starting and ending with /). */
export function pageMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  const url = (l: Locale) => `${SITE.origin}${base}${prefixOf(l)}${path}`;
  return {
    // The home page's title is the site name alone, without the " · Brazilian Utils" suffix.
    title: title === 'Brazilian Utils' ? { absolute: title } : title,
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
    icons: { icon: `${servedBase}/favicon.ico`, apple: `${servedBase}/apple-touch-icon.png` },
    ...(NOINDEX && { robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } } }),
    openGraph: { siteName: 'Brazilian Utils', locale: locale === 'en' ? 'en_US' : 'pt_BR' },
  };
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f0e5' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1b1a' },
  ],
};
