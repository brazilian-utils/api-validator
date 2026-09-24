// The shared test cases of one function, as JSON written at build time (static export): the rows
// of the table the utility page shows when the reader opens the cases (lazy-cases.client.tsx),
// so the page itself does not carry every case of every function.
import { casesData } from '@/lib/cases-data';
import { loadSpecs } from '@/lib/data';
import { LOCALES, type Locale } from '@/lib/i18n';

export const dynamic = 'force-static';
export const dynamicParams = false;

const slugOf = (locale: Locale) => (locale === 'en' ? 'en' : 'pt-br');
const localeOf = (slug: string): Locale | undefined => LOCALES.find((l) => slugOf(l) === slug);

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    loadSpecs().flatMap((spec: any) => spec.operations.filter((op: any) => op.tests?.length).map((op: any) => ({ locale: slugOf(locale), util: spec.id, fn: `${op.id}.json` }))),
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; util: string; fn: string }> }) {
  const { locale, util, fn } = await params;
  const l = localeOf(locale);
  const data = l && casesData(l, util, fn.replace(/\.json$/, ''));
  if (!data) return new Response('Not found', { status: 404 });
  return Response.json(data);
}
