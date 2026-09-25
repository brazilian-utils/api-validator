// Usage snippets fetched from each library (site/scripts/fetch-libs.mjs): one Markdown file per
// library, utility and function, in .cache/usage/<lib>/<util>/<op>[.pt-BR].md.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from './data';
import type { Locale } from './i18n';

export interface UsageEntry {
  body: string;
  source?: string;
  since?: string;
  locale: Locale;
}

const front = (text: string) => {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const data: Record<string, string> = {};
  if (m) for (const line of m[1].split('\n')) {
    const kv = /^(\w+):\s*"?(.*?)"?\s*$/.exec(line);
    if (kv) data[kv[1]] = kv[2];
  }
  return { data, body: m ? text.slice(m[0].length) : text };
};

/** The usage of one function in one library, in the page's language when the library has it. */
export function loadUsage(lib: string, util: string, op: string, locale: Locale): UsageEntry | null {
  for (const l of locale === 'en' ? ['en'] : [locale, 'en']) {
    const file = path.join(CACHE_DIR, lib, util, `${op}${l === 'en' ? '' : `.${l}`}.md`);
    if (!fs.existsSync(file)) continue;
    const { data, body } = front(fs.readFileSync(file, 'utf8'));
    return { body, source: data.source, since: data.since, locale: l as Locale };
  }
  return null;
}

/** First `since:` any usage file of the utility gives for a library. */
export function sinceOf(lib: string, util: string) {
  const dir = path.join(CACHE_DIR, lib, util);
  if (!fs.existsSync(dir)) return undefined;
  for (const f of fs.readdirSync(dir)) {
    const since = front(fs.readFileSync(path.join(dir, f), 'utf8')).data.since;
    if (since) return since;
  }
  return undefined;
}
