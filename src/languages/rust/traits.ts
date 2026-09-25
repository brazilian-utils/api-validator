import type { TypeNode } from "../../core/model.js";

const last = (name: string) => name.split("::").pop()!;
/** `impl Into<String>` / `impl AsRef<str>` / `impl ToString`: parameters that take strings. */
export const isStringTrait = (n: TypeNode) =>
  n.kind === "name" &&
  ((last(n.name) === "Into" && n.args?.[0]?.kind === "name" && last(n.args[0].name) === "String") ||
    (last(n.name) === "AsRef" && n.args?.[0]?.kind === "name" && n.args[0].name === "str") ||
    last(n.name) === "ToString");
