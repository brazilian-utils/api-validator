// The highlighted files of one guide example, as JSON written at build time (static export):
// { "<file name>": { style, html, lang } }. The guide page fetches it when the example's tab shows
// (guide-files.client.tsx), so the page itself does not carry every file of every example.
import { codeHtml, guideExamplesWithFiles } from '@/lib/code-html';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return guideExamplesWithFiles().map((e) => ({ lib: e.lib, slug: e.slug, example: `${e.example}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ lib: string; slug: string; example: string }> }) {
  const { lib, slug, example } = await params;
  const id = example.replace(/\.json$/, '');
  const found = guideExamplesWithFiles().find((e) => e.lib === lib && e.slug === slug && e.example === id);
  if (!found) return new Response('Not found', { status: 404 });
  const files: Record<string, { style: string; html: string; lang?: string }> = {};
  for (const f of found.files) files[f.name] = { ...(await codeHtml(f.code, f.lang)), lang: f.lang };
  return Response.json(files);
}
