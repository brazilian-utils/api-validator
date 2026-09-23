/**
 * Canonical formatting of the hand-edited JSON (`api-validator fmt`): contract/*.json and
 * libs/*.json in a stable key order, one test case per line (see jsonfmt.ts), and the JSON
 * Schemas in schema/ that editors use to validate and autocomplete those files.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DomainFileSchema } from "./contract.js";
import { formatJson, orderDomain, orderLib } from "./jsonfmt.js";
import { LibSchema } from "./libs.js";

type Kind = "contract" | "lib";

/** Format every `*.json` of a dir in place; returns the names of the files that changed. */
export function formatDir(dir: string, kind: Kind): string[] {
  const changed: string[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const file = path.join(dir, f);
    const before = fs.readFileSync(file, "utf8");
    let doc: Record<string, never>;
    try {
      doc = JSON.parse(before);
    } catch {
      continue; // lint reports it
    }
    const after = formatJson(kind === "contract" ? orderDomain(doc) : orderLib(doc));
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed.push(f);
    }
  }
  return changed;
}

/** Back-compat name used by `diff --apply`. */
export function formatContractDir(dir: string): string[] {
  return formatDir(dir, "contract");
}

/** JSON Schemas of the edited files, generated from the validation schemas (never drift). */
export function schemaFiles(): Map<string, string> {
  const gen = (schema: z.ZodType, title: string) =>
    formatJson({ ...z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }), title });
  return new Map([
    ["contract.schema.json", gen(DomainFileSchema, "brazilian-utils contract: one domain (contract/<domain>.json)")],
    ["lib.schema.json", gen(LibSchema, "brazilian-utils lib config (libs/<name>.json)")]
  ]);
}
