// The lists behind a page's coverage summaries, as JSON written at build time (static export),
// one file per page and language: { "<key>": { title, items, href, hrefText } }. Fetched by the
// page's one popover (breakdown.client.tsx) the first time a summary is hovered or tapped.
import { breakdownDetails, breakdownPages, localeOf, localeSlug } from '@/lib/breakdown-data';
import { LOCALES } from '@/lib/i18n';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => breakdownPages().map((page) => ({ page: `${page}.${localeSlug(locale)}.json` })));
}

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const m = /^(.+)\.(en|pt-br)\.json$/.exec(page);
  const locale = m && localeOf(m[2]);
  const details = m && locale ? breakdownDetails(m[1], locale) : null;
  if (!details) return new Response('Not found', { status: 404 });
  return Response.json(details);
}
