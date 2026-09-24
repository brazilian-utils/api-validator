// The site's data: the contract, the libraries, the last validator run. Shared with the build
// scripts (plain ESM, no framework).
import { loadLibs } from './registry.mjs';

export * from './registry.mjs';
export * from './text.mjs';

/** The libraries' names as one list in the page's language ("JavaScript, Python, Go, Ruby, Rust, .NET and
 *  Erlang"), from libs/: a sentence that names them never goes stale. */
export const libNames = (locale: string) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(loadLibs().map((l: any) => l.label));
