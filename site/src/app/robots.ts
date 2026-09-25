import type { MetadataRoute } from 'next';
import { NOINDEX, SITE } from '@/lib/meta';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  // Review deployments stay out of search engines through noindex on every page and file, which a
  // crawler can only read when robots.txt lets it in; so no Disallow here, and no sitemap.
  if (NOINDEX) return { rules: { userAgent: '*', allow: '/' } };
  // The libraries' live demos (lib-assets/) are frames inside the guides, not pages to index.
  return { rules: { userAgent: '*', allow: '/', disallow: `${SITE.pathname.replace(/\/$/, '')}/lib-assets/` }, sitemap: `${SITE.origin}${SITE.pathname.replace(/\/$/, '')}/sitemap.xml` };
}
