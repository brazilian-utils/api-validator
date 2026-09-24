// /llms.txt (llmstxt.org): what the site is and where each page is, for AI tools and agents.
import { libNames, loadGuides, loadLibs, loadSpecs } from '@/lib/data';
import { SITE_ROOT } from '@/lib/meta';
import { folderPages } from '@/lib/source';

export const dynamic = 'force-static';

export function GET() {
  const lines = [
    '# Brazilian Utils',
    '',
    `> Validate, format, parse and generate Brazilian documents (CPF, CNPJ, CEP, license plates, boletos and more) in ${libNames('en')}. One shared contract defines every function and its test cases. Each library runs the cases of the functions it has. Portuguese pages live under /pt-br/.`,
    '',
    '## Start',
    '',
    `- [Getting started](${SITE_ROOT}/getting-started/): what the libraries do and how to read a utility page`,
    `- [Parity matrix](${SITE_ROOT}/reference/parity/): which library implements which utility`,
    '',
    '## Utilities',
    '',
    ...loadSpecs().map((s: any) => `- [${s.title.en}](${SITE_ROOT}/utils/${s.id}/): ${s.summary.en} Functions: ${s.operations.map((o: any) => o.fnId).join(', ')}.`),
    '',
    '## Libraries',
    '',
    ...loadLibs().map((l: any) => `- [${l.label}](${SITE_ROOT}/libs/${l.id}/): package ${l.package}, install with \`${l.install}\`${l.installs.length > 1 ? ` (also ${l.installs.slice(1).map((o: any) => o.label).join(', ')})` : ''}${l.runtimes.length ? `. Runs on ${l.runtimes.map((r: any) => (typeof r.name === 'string' ? r.name : r.name.en)).join(', ')}` : ''}`),
    '',
    '## Guides',
    '',
    ...loadGuides().map((g: any) => `- [${g.title.en}](${SITE_ROOT}/guides/${g.lib}/${g.slug}/): ${g.description.en}`),
    '',
    '## Optional',
    '',
    ...folderPages('en', 'contributing').map((page) => `- [${page.title}](${SITE_ROOT}/contributing/${page.slug}/)`),
    ...folderPages('en', 'about').map((page) => `- [${page.title}](${SITE_ROOT}/about/${page.slug}/)`),
    `- [Test case schema (JSON)](${SITE_ROOT}/cases.schema.json)`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
