// Structured data for search engines: the site, the organization and its seven libraries.
import { loadLibs } from '@/lib/data';
import { SITE_ROOT } from '@/lib/meta';
import { type Locale, prefixOf } from '@/lib/i18n';

export function HomeJsonLd({ locale, description }: { locale: Locale; description: string }) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE_ROOT}/#website`, url: `${SITE_ROOT}${prefixOf(locale)}/`, name: 'Brazilian Utils', description, inLanguage: locale },
      { '@type': 'Organization', '@id': 'https://github.com/brazilian-utils#org', name: 'Brazilian Utils', url: 'https://github.com/brazilian-utils', logo: `${SITE_ROOT}/og.png` },
      ...loadLibs().map((lib: any) => ({
        '@type': 'SoftwareSourceCode',
        name: `Brazilian Utils for ${lib.label}`,
        programmingLanguage: lib.label,
        codeRepository: `https://github.com/${lib.repo}`,
        url: `${SITE_ROOT}${prefixOf(locale)}/libs/${lib.id}/`,
        author: { '@id': 'https://github.com/brazilian-utils#org' },
      })),
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
