// sitemap.xml: every page in both languages, each with its twin (hreflang).
import type { MetadataRoute } from 'next';
import { loadGuides, loadLibs, loadSpecs } from '@/lib/data';
import { SITE } from '@/lib/meta';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = `${SITE.origin}${SITE.pathname.replace(/\/$/, '')}`;
  const paths = [
    '/',
    '/getting-started/',
    '/reference/parity/',
    ...['specs', 'usage-files', 'new-language'].map((s) => `/contributing/${s}/`),
    ...loadSpecs().map((s: any) => `/utils/${s.id}/`),
    ...loadLibs().map((l: any) => `/libs/${l.id}/`),
    ...loadGuides().map((g: any) => `/guides/${g.lib}/${g.slug}/`),
  ];
  return paths.flatMap((path) => {
    const languages = { en: `${base}${path}`, 'pt-BR': `${base}/pt-br${path}` };
    return [
      { url: languages.en, alternates: { languages }, priority: path === '/' ? 1 : path.startsWith('/utils/') ? 0.8 : 0.6 },
      { url: languages['pt-BR'], alternates: { languages }, priority: path === '/' ? 1 : path.startsWith('/utils/') ? 0.8 : 0.6 },
    ];
  });
}
