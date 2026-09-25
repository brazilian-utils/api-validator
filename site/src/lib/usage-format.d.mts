// Types for usage-format.mjs (plain ESM so the site's scripts run it without a build step).
export type Locale = 'en' | 'pt-BR';
export type Label = { en: string; 'pt-BR': string };

export function slugOf(domain: string): string;
export function keyOf(s: unknown): string;
export function shortName(name: string): string;
export function repoSlug(url: string): string;
export const OP_ORDER: string[];
export function opRank(op: string): number;
export const OP_ALIASES: Record<string, string>;
export const DEFAULT_LABELS: Record<string, Label>;
export function operationLabel(op: string, label?: Label): Label;
export function stripFrontMatter(text: string): string;
export function parseUsageFileName(name: string): { stem: string; locale: Locale } | null;
export function splitSections(body: string): Array<{ heading: string; body: string }>;
export function resolveOperation(ops: ReadonlyArray<{ id: string; label: { en: string } }>, heading: string): string | undefined;
export function symbolMap(entries: Iterable<readonly [string, string | undefined]>): Map<string, string>;
export function referenceSections(
  body: string,
  bySymbol: ReadonlyMap<string, string>
): { sections: Array<{ fnId: string; symbol: string; body: string }>; intro: string };
