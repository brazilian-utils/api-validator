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
 * parseGuide turns one into blocks for the guide pages (src/components/pages/guide.tsx): prose, and groups of
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
  const { src, file } = ctx;
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
  if (node.kind === 'variant') node.name = node.variant ?? node.name;
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
 * Links in a guide: to a sibling guide → that guide here; the rest as absolutizeLinks does
 * (reference anchors → the operation here, other relative links → GitHub).
 */
function rewriteLinks(md, ctx) {
  const prefix = ctx.locale === 'pt-BR' ? '/pt-br' : '';
  const guidesDir = path.join(ctx.src.dir, ctx.lib.guides[ctx.locale]);
  return absolutizeLinks(md, {
    fromFile: ctx.file,
    srcDir: ctx.src.dir,
    srcUrl: ctx.src.url,
    docsRoot: path.join(ctx.src.dir, ctx.lib.root),
    reference: referenceFiles(ctx),
    anchor: referenceAnchor(ctx),
    page: (target, hash) =>
      path.dirname(target) === guidesDir && target.endsWith('.md') && ctx.siblings.includes(path.basename(target, '.md'))
        ? `${prefix}/guides/${ctx.lib.id}/${path.basename(target, '.md')}/${hash ? `#${hash}` : ''}`
        : null,
  });
}

/** The library's reference pages (every language), as absolute paths. ctx: { lib: { reference }, src: { dir } }. */
export const referenceFiles = (ctx) => Object.values(ctx.lib.reference ?? {}).map((r) => path.join(ctx.src.dir, r));

/** Fenced blocks and code spans: what looks like a link inside them is code. */
const CODE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1[^\S\n]*$|(?![\s\S]))|(`+)(?!`)[\s\S]*?(?<!`)\2(?!`)/gm;
const IMAGE = /(!\[[^\]\n]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;
const HTML_IMAGE = /(<img\b[^>]*?\bsrc=")([^"]+)(")/g;
const LINK = /(\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g;

/** Apply `fn` to the parts of a Markdown text outside code. */
function outsideCode(md, fn) {
  let out = '';
  let last = 0;
  for (const m of md.matchAll(CODE)) {
    out += fn(md.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(md.slice(last));
}

/**
 * Relative links and images of a library's Markdown, made to work on this site. A link resolves
 * from the file's folder and, the way docsify does, from the docs root (`/x.md` is docs-root
 * relative), and becomes the file on GitHub (`srcUrl`); an image becomes its raw file. Absolute
 * URLs, `mailto:` and anything inside code stay as they are. Optional hooks, tried first:
 *   anchor(hash)         a symbol anchor of a reference page (`reference`: absolute paths; a bare
 *                        `#hash` counts when `fromFile` is one) → a path on this site, or null
 *   page(target, hash)   any other resolved file → a path on this site, or null
 */
export function absolutizeLinks(md, { fromFile, srcDir, srcUrl, docsRoot = srcDir, reference = [], anchor, page }) {
  const raw = srcUrl.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\//, 'https://raw.githubusercontent.com/$1/');
  const external = (url) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url);
  const resolve = (p) => {
    const candidates = p.startsWith('/') ? [path.join(docsRoot, p)] : [path.resolve(path.dirname(fromFile), p), path.resolve(docsRoot, p)];
    const target = candidates.find((c) => fs.existsSync(c)) ?? candidates[0];
    return { target, rel: path.relative(srcDir, target).split(path.sep).join('/') };
  };
  const image = (all, a, url, z) => {
    if (external(url) || url.startsWith('#')) return all;
    const [p, rest = ''] = url.split(/(?=[?#])/);
    return `${a}${raw}${resolve(p).rel}${rest}${z}`;
  };
  const link = (all, a, url, z) => {
    if (external(url)) return all;
    const [p, hash = ''] = url.split('#');
    if (!p) {
      const here = reference.includes(fromFile) && anchor?.(hash);
      return here ? `${a}${here}${z}` : all;
    }
    const { target, rel } = resolve(p);
    const here = (reference.includes(target) && anchor?.(hash)) || page?.(target, hash);
    return `${a}${here || `${srcUrl}${rel}${hash ? `#${hash}` : ''}`}${z}`;
  };
  return outsideCode(md, (text) => text.replace(IMAGE, image).replace(HTML_IMAGE, image).replace(LINK, link));
}

/**
 * `formatcpf` (a reference anchor) → `/utils/cpf/#format` (with the locale prefix) when the
 * symbol implements a contract function, else null. ctx: { lib: { id }, locale, status, specs }.
 */
export function referenceAnchor(ctx) {
  const prefix = ctx.locale === 'pt-BR' ? '/pt-br' : '';
  const fns = ctx.status?.libs?.[ctx.lib.id]?.functions ?? {};
  const ops = new Map(ctx.specs.flatMap((spec) => spec.operations.map((op) => [`${spec.domain}.${op.id}`, { spec, op }])));
  return (hash) => {
    if (!hash) return null;
    const hit = Object.entries(fns).find(([, f]) => f.symbol && f.symbol.split(/[.:]/).pop().toLowerCase() === hash.toLowerCase());
    const found = hit && ops.get(hit[0]);
    return found ? `${prefix}/utils/${found.spec.id}/#${headingSlug(found.op.label[ctx.locale] ?? found.op.label.en)}` : null;
  };
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
