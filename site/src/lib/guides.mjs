/**
 * Library guides: Markdown pages whose examples come in framework / variant / file tabs with an
 * optional live demo, marked up the way docsify renders them (one tag per line):
 *
 *   <div class="example" data-name="React" data-demo="/snippets/live/?…">
 *     <div class="variant" data-variant="CPF" data-demo="…">          (optional level)
 *       <div class="file" data-file="cpf-field.tsx">
 *         [cpf-field.tsx](../snippets/…/cpf-field.tsx ':include :type=code tsx')   (or a fenced block)
 *       </div>
 *     </div>
 *   </div>
 *
 * parseGuide turns one into blocks for scripts/generate-pages.mjs: prose, and groups of
 * examples with their files inlined, demo URLs moved under /lib-assets/<lib>/ and links
 * rewritten for this site. Used by scripts/fetch-libs.mjs; tested in ../../test/site.test.ts.
 *
 * ctx: { lib, src: { dir, url }, file, locale, siblings: slugs of the guides next to it,
 *        status: .generated/status.json (symbols → contract functions), specs, warn(message) }
 */
import fs from 'node:fs';
import path from 'node:path';
import { headingSlug } from './text.mjs';

const OPEN = /^\s*<div\s+class="(example|variant|file)"([^>]*)>\s*$/;
const CLOSE = /^\s*<\/div>\s*$/;

export function frontmatter(text) {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(text);
  if (!m) return [{}, text];
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    try {
      data[kv[1]] = JSON.parse(kv[2]);
    } catch {
      data[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return [data, text.slice(m[0].length)];
}

function attrs(s) {
  return Object.fromEntries([...s.matchAll(/data-([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

/**
 * A guide as blocks: `{ type: 'markdown', text }` and `{ type: 'examples', examples: [...] }`,
 * where consecutive `example` divs form one tab group. Files are inlined; demo URLs and links
 * are rewritten for this site.
 */
export function parseGuide(ctx) {
  const { lib, src, file } = ctx;
  const [data, body] = frontmatter(fs.readFileSync(file, 'utf8'));
  const relFile = path.relative(src.dir, file);
  const blocks = [];
  const stack = [];
  let text = [];
  const flushText = () => {
    const t = text.join('\n').trim();
    text = [];
    if (t) blocks.push({ type: 'markdown', text: rewriteLinks(t, ctx) });
  };
  for (const line of body.split('\n')) {
    const open = OPEN.exec(line);
    if (open) {
      const node = { kind: open[1], ...attrs(open[2]), text: [], children: [] };
      if (!stack.length) {
        const t = text.join('\n').trim();
        const last = blocks[blocks.length - 1];
        if (t || last?.type !== 'examples') {
          flushText();
          blocks.push({ type: 'examples', examples: [] });
        } else text = [];
        blocks[blocks.length - 1].examples.push(node);
      } else stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }
    if (stack.length && CLOSE.test(line)) {
      finish(stack.pop(), ctx);
      continue;
    }
    (stack.length ? stack[stack.length - 1].text : text).push(line);
  }
  flushText();
  const code = [];
  const walk = (n) => {
    if (n.kind === 'file') code.push(n.code);
    n.children?.forEach(walk);
  };
  blocks.filter((b) => b.type === 'examples').forEach((b) => b.examples.forEach(walk));
  return {
    title: data.title ?? path.basename(file, '.md'),
    description: data.description ?? '',
    blocks,
    fns: functionsUsed(ctx, [...code, ...blocks.filter((b) => b.type === 'markdown').map((b) => b.text)].join('\n')),
    source: src.url + relFile,
  };
}

/** Shape a closed div: files get their code, examples and variants their prose and demo URL. */
function finish(node, ctx) {
  const text = node.text.join('\n').trim();
  delete node.text;
  if (node.kind === 'file') {
    node.name = node.file;
    delete node.file;
    delete node.children;
    const include = /\[[^\]]*\]\(([^)\s]+)\s+'([^']*:include[^']*)'\)/.exec(text);
    if (include) {
      const target = path.resolve(path.dirname(ctx.file), include[1]);
      node.lang = /:type=code\s+(\w+)/.exec(include[2])?.[1] ?? path.extname(target).slice(1);
      if (fs.existsSync(target)) node.code = fs.readFileSync(target, 'utf8');
      else {
        node.code = `// ${include[1]} was not found in ${ctx.lib.repo}`;
        ctx.warn(`${ctx.lib.id}/${path.relative(ctx.src.dir, ctx.file)}: included file ${include[1]} not found (does the library's prepare step generate it?)`);
      }
    } else {
      const fence = /^(`{3,}|~{3,})(\w*)[^\n]*\n([\s\S]*?)\n\1\s*$/m.exec(text);
      node.lang = fence?.[2] || path.extname(node.name ?? '').slice(1);
      node.code = fence ? fence[3] : text;
    }
    return;
  }
  node.name = node.kind === 'variant' ? node.variant ?? node.name : node.name;
  delete node.variant;
  if (text) node.intro = rewriteLinks(text, ctx);
  if (node.demo) node.demo = demoUrl(node.demo, ctx);
}

/** Demo URLs are relative to the library's docs root; on this site they live under lib-assets/<lib>/. */
function demoUrl(url, ctx) {
  if (/^https?:\/\//.test(url)) return url;
  const [p, q] = url.split('?');
  const root = path.join(ctx.src.dir, ctx.lib.root);
  const abs = p.startsWith('/') ? path.join(root, p) : path.resolve(path.dirname(ctx.file), p);
  const rel = path.relative(root, abs).split(path.sep).join('/') + (p.endsWith('/') ? '/' : '');
  return `/lib-assets/${ctx.lib.id}/${rel}${q === undefined ? '' : `?${q}`}`;
}

/**
 * Links in a guide: to a sibling guide → that guide here; to the library's reference page with a
 * symbol anchor (`utilities.md#formatcpf`) → the operation on its utility page here; anything
 * else relative → the file on GitHub. Relative links resolve from the guide's folder and, the
 * way docsify does, from the docs root.
 */
function rewriteLinks(md, ctx) {
  const prefix = ctx.locale === 'pt-BR' ? '/pt-br' : '';
  const root = path.join(ctx.src.dir, ctx.lib.root);
  const guidesDir = path.join(ctx.src.dir, ctx.lib.guides[ctx.locale]);
  const reference = ctx.lib.reference && Object.values(ctx.lib.reference).map((r) => path.join(ctx.src.dir, r));
  return md.replace(/(\]\()([^)\s]+)(\))/g, (all, a, url, z) => {
    if (/^(https?:|mailto:|#|\/)/.test(url)) return all;
    const [p, hash = ''] = url.split('#');
    const candidates = [path.resolve(path.dirname(ctx.file), p), path.resolve(root, p)];
    const target = candidates.find((c) => fs.existsSync(c)) ?? candidates[0];
    if (path.dirname(target) === guidesDir && target.endsWith('.md') && ctx.siblings.includes(path.basename(target, '.md'))) {
      return `${a}${prefix}/guides/${ctx.lib.id}/${path.basename(target, '.md')}/${hash ? `#${hash}` : ''}${z}`;
    }
    if (reference?.includes(target)) {
      const here = operationAnchor(ctx, hash);
      if (here) return `${a}${prefix}${here}${z}`;
    }
    const rel = path.relative(ctx.src.dir, target).split(path.sep).join('/');
    return `${a}${ctx.src.url}${rel}${hash ? `#${hash}` : ''}${z}`;
  });
}

/** `formatcpf` (a reference anchor) → `/utils/cpf/#format`, when the symbol implements a contract function. */
function operationAnchor(ctx, anchor) {
  if (!anchor) return null;
  const locale = ctx.locale;
  const fns = ctx.status?.libs?.[ctx.lib.id]?.functions ?? {};
  const hit = Object.entries(fns).find(([, f]) => f.symbol && f.symbol.split(/[.:]/).pop().toLowerCase() === anchor.toLowerCase());
  if (!hit) return null;
  const dot = hit[0].lastIndexOf('.');
  const spec = ctx.specs.find((s) => s.domain === hit[0].slice(0, dot));
  const op = spec?.operations.find((o) => o.id === hit[0].slice(dot + 1));
  return op ? `/utils/${spec.id}/#${headingSlug(op.label[locale] ?? op.label.en)}` : null;
}

/** Contract functions a guide calls: the library's symbols (from the last validator run) found in its code. */
function functionsUsed(ctx, code) {
  const fns = ctx.status?.libs?.[ctx.lib.id]?.functions ?? {};
  const out = [];
  for (const [fnId, f] of Object.entries(fns)) {
    if (!f.symbol || !['ok', 'failing', 'signature'].includes(f.status)) continue;
    const name = f.symbol.split(/[.:]/).pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^\\w$])${name}(?![\\w$])`).test(code)) out.push(fnId);
  }
  return out;
}
