// Contract prose helpers: open decisions pulled out of a description, links to the findings.
import { REPO_URL } from './data';

/** Bullets "Pending decision …" of a description, apart from the rest of the text. */
export function splitPending(markdown: string) {
  const pending: string[] = [];
  const text = markdown
    .split('\n')
    .filter((line) => {
      const m = /^\s*[-*]\s+(?:Pending decision|Decisão pendente)\s*(.*)$/i.exec(line);
      if (m) pending.push(m[1].replace(/^[:\s]+/, ''));
      return !m;
    })
    .join('\n');
  return { text, pending };
}

const FINDINGS: Record<string, string> = {
  '1': '1-cases-in-the-contract-that-some-libraries-fail',
  '1b': '1b-found-by-the-506-cases-added-from-the-js-reference-tests',
  '2': '2-decisions-needed-not-encoded-yet',
};

/** "(findings §2 #1): text" → "Text See [the open decision in docs/findings.md](…)." */
export function linkFindings(note: string, locale: string) {
  const m = /^\(findings (§(\w+)[^)]*)\):?\s*/.exec(note);
  if (!m) return note;
  const text = note.slice(m[0].length).replace(/^./, (c) => c.toUpperCase());
  const label = locale === 'pt-BR' ? 'a decisão em aberto em docs/findings.md (em inglês)' : 'the open decision in docs/findings.md';
  const anchor = FINDINGS[m[2]] ? `#${FINDINGS[m[2]]}` : '';
  const link = `[${label}](${REPO_URL}/blob/main/docs/findings.md${anchor})`;
  return `${text} ${locale === 'pt-BR' ? 'Veja' : 'See'} ${link}.`;
}

/** Headings one level down, outside code blocks, so embedded Markdown nests under a section. */
export function demoteHeadings(markdown: string) {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      return !inFence && /^#{1,5}\s/.test(line) ? `#${line}` : line;
    })
    .join('\n');
}

/** A long-form spec under the page's "Specification" section: its own title dropped. */
export const demote = (markdown: string) => demoteHeadings(markdown.replace(/^# .*\n/m, ''));

/** Heading anchors (github-slugger rules). */
export { headingSlug as slug } from './text.mjs';
