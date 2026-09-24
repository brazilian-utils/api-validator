// A code block highlighted at build time as HTML text, for the files of a guide example that the
// page fetches on demand (guide-files.client.tsx) instead of carrying in its payload: as React
// elements, sixty highlighted files weigh megabytes; as HTML text they are fetched one example
// at a time, and only when its tab shows.
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { rehypeCode } from 'fumadocs-core/mdx-plugins/rehype-code';
import { toHtml } from 'hast-util-to-html';
import type { Element } from 'hast';
import { loadGuide, loadGuides } from './data';

const processor = unified().use(remarkParse).use(remarkRehype).use(rehypeCode, {
  themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
});

/** A fenced code block that survives any backticks in the code. */
export function fence(code: string, lang?: string, title?: string) {
  const longest = Math.max(2, ...[...String(code).matchAll(/`+/g)].map((m) => m[0].length));
  const marks = '`'.repeat(longest + 1);
  return `${marks}${lang ?? ''}${title ? ` title=${JSON.stringify(title)}` : ''}\n${String(code).replace(/\n$/, '')}\n${marks}`;
}

export interface CodeHtml {
  /** The `<pre>`'s style (the theme colors) and its `<code>` contents, the highlighted lines. */
  style: string;
  html: string;
}

/** The first element with this tag name, anywhere under `node` (the tree nests a root in a root). */
function find(node: { children?: unknown[] }, tagName: string): Element | undefined {
  for (const child of (node.children ?? []) as Array<{ type: string; tagName?: string; children?: unknown[] }>) {
    if (child.type === 'element' && child.tagName === tagName) return child as unknown as Element;
    if (child.type !== 'element' && child.type !== 'root') continue;
    const found = find(child, tagName);
    if (found) return found;
  }
  return undefined;
}

/** The highlighted lines of one file. */
export async function codeHtml(code: string, lang?: string): Promise<CodeHtml> {
  const tree = await processor.run(processor.parse(fence(code, lang)));
  const pre = find(tree, 'pre');
  const codeEl = pre && find(pre, 'code');
  if (!pre || !codeEl) throw new Error(`no code block for ${lang ?? 'text'}: ${code.slice(0, 40)}`);
  return { style: String(pre.properties.style ?? ''), html: toHtml(codeEl.children as never) };
}

export interface GuideFile {
  name: string;
  lang?: string;
}

/** Where the highlighted files of an example are fetched from, and the example's id in it. */
export const exampleId = (framework: string, variant?: string) => [framework, variant].filter(Boolean).map((s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('--');
export const codeUrl = (base: string, lib: string, slug: string, example: string) => `${base}/api/guide-code/${lib}/${slug}/${example}.json`;

/** Every example of every guide that has files, with the ids the route builds. */
export function guideExamplesWithFiles(): Array<{ lib: string; slug: string; example: string; files: Array<{ name: string; code: string; lang?: string }> }> {
  const out: Array<{ lib: string; slug: string; example: string; files: Array<{ name: string; code: string; lang?: string }> }> = [];
  for (const entry of loadGuides() as Array<{ lib: string; slug: string }>) {
    const guide = loadGuide(entry.lib, entry.slug, 'en');
    if (!guide) continue;
    for (const block of guide.blocks as Array<{ type: string; examples?: any[] }>) {
      if (block.type === 'markdown' || !block.examples) continue;
      for (const ex of block.examples) {
        const variants = ex.children.filter((c: any) => c.kind === 'variant');
        for (const node of variants.length ? variants : [ex]) {
          const files = node.children.filter((c: any) => c.kind === 'file');
          if (files.length) out.push({ lib: entry.lib, slug: entry.slug, example: exampleId(ex.name, variants.length ? node.name : undefined), files });
        }
      }
    }
  }
  return out;
}
