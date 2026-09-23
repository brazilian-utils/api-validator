import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/meta';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE.origin}${SITE.pathname.replace(/\/$/, '')}/sitemap.xml` };
}
