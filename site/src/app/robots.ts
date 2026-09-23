import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/meta';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  // Review deployments (Vercel previews) stay out of search engines; the canonical site is SITE_URL.
  if (process.env.VERCEL_ENV === 'preview') return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE.origin}${SITE.pathname.replace(/\/$/, '')}/sitemap.xml` };
}
