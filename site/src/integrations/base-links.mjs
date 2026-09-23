/**
 * Prefixes the site's base path to root-relative links written in the hand-written pages
 * (`[parity](/reference/parity/)`, hero actions), so the site works both at a domain root and
 * under a sub-path such as GitHub Pages' `/<repo>/`. Components build their URLs from
 * BASE_URL already; this only touches `href="/…"` that lacks the base, after the build.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default function baseLinks(base) {
  const prefix = base.replace(/\/$/, '');
  return {
    name: 'base-links',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        if (!prefix) return;
        const root = fileURLToPath(dir);
        const escaped = prefix.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(<a\\b[^>]*?\\bhref=")/(?!/|${escaped}/)`, 'g');
        let changed = 0;
        const walk = async (d) => {
          for (const e of await fs.readdir(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) await walk(p);
            else if (e.name.endsWith('.html')) {
              const html = await fs.readFile(p, 'utf8');
              const out = html.replace(re, `$1${prefix}/`);
              if (out !== html) {
                changed++;
                await fs.writeFile(p, out);
              }
            }
          }
        };
        await walk(root);
        logger.info(`prefixed ${prefix}/ to root-relative links in ${changed} pages`);
      },
    },
  };
}
