// Types for guides.mjs (plain ESM so the site's scripts run it without a build step).
export interface GuideFile { kind: 'file'; name: string; lang: string; code: string }
export interface GuideNode { kind: 'example' | 'variant'; name?: string; demo?: string; intro?: string; children: Array<GuideNode | GuideFile> }
export type GuideBlock = { type: 'markdown'; text: string } | { type: 'examples'; examples: GuideNode[] };
export interface Guide { title: string; description: string; blocks: GuideBlock[]; fns: string[]; source: string }
export interface GuideContext {
  lib: { id: string; repo: string; root: string; guides: Record<string, string>; reference?: Record<string, string> };
  src: { dir: string; url: string };
  file: string;
  locale: 'en' | 'pt-BR';
  siblings: string[];
  status: { libs?: Record<string, { functions: Record<string, { status: string; symbol?: string }> }> } | null;
  specs: Array<{ id: string; domain: string; operations: Array<{ id: string; label: Record<string, string> }> }>;
  warn: (message: string) => void;
}
export function parseGuide(ctx: GuideContext): Guide;
export function frontmatter(text: string): [Record<string, unknown>, string];
