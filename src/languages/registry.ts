import { dotnet } from "./dotnet/index.js";
import { erlang } from "./erlang/index.js";
import { go } from "./go/index.js";
import { python } from "./python/index.js";
import { ruby } from "./ruby/index.js";
import { rust } from "./rust/index.js";
import type { LanguageAdapter } from "./types.js";
import { typescript } from "./typescript/index.js";

/** Every supported language. To add one, implement LanguageAdapter and list it here. */
const ADAPTERS: LanguageAdapter[] = [typescript, python, go, rust, ruby, erlang, dotnet];

export function getAdapter(language: string): LanguageAdapter {
  const key = language.toLowerCase();
  const found = ADAPTERS.find((a) => a.id === key || a.aliases?.includes(key));
  if (!found) {
    throw new Error(`No adapter for language "${language}". Known: ${ADAPTERS.map((a) => a.id).join(", ")}`);
  }
  return found;
}
