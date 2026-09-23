import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Contract, Issue, LibConfig } from "./model.js";

export const LibSchema = z
  .object({
    $schema: z.string().optional(),
    name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    language: z.string().min(1),
    /** Free text for maintainers (JSON has no comments). */
    notes: z.string().optional(),
    repo: z.string().url().optional(),
    branch: z.string().optional(),
    entry: z.string().default("."),
    bindings: z.record(z.string(), z.union([z.string(), z.array(z.string()).min(1)])).default({}),
    ignore: z.array(z.string()).default([]),
    waivers: z.record(z.string(), z.string().min(1)).default({}),
    knownFailures: z.record(z.string(), z.string().min(1)).default({}),
    options: z.record(z.string(), z.unknown()).default({}),
    /** How the docs site shows this lib: tab label and order, install line, where its usage files live. */
    site: z
      .object({
        label: z.string().min(1),
        icon: z.string().optional(),
        order: z.number().int(),
        package: z.string().min(1),
        install: z.string().min(1),
        registry: z.string().url(),
        usage: z.object({ ref: z.string().default("latest-release"), path: z.string().default("docs/usage") }).strict().default({ ref: "latest-release", path: "docs/usage" })
      })
      .strict()
      .optional()
  })
  .strict();

export function loadLibConfigs(dir: string): LibConfig[] {
  const problems: string[] = [];
  const libs: LibConfig[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const rel = path.join(path.basename(dir), file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      problems.push(`${rel}: JSON error: ${(e as Error).message}`);
      continue;
    }
    const parsed = LibSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) problems.push(`${rel}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      continue;
    }
    if (`${parsed.data.name}.json` !== file) problems.push(`${rel}: lib "${parsed.data.name}" must live in ${parsed.data.name}.json`);
    const { $schema: _schema, notes: _notes, ...config } = parsed.data;
    libs.push({ ...config, source: rel });
  }
  if (problems.length > 0) throw new Error(`Invalid lib config:\n  - ${problems.join("\n  - ")}`);
  return libs;
}

/** Semantic checks of a lib config against the contract (stale bindings, waivers, ...). */
export function validateLibAgainstContract(lib: LibConfig, contract: Contract): Issue[] {
  const issues: Issue[] = [];
  const testIds = new Set([...contract.functions.values()].flatMap((f) => f.tests.map((t) => t.id)));
  for (const id of Object.keys(lib.bindings)) {
    if (!contract.functions.has(id)) {
      issues.push({ severity: "error", code: "binding-unknown-fn", message: `${lib.source}: binding for unknown contract function "${id}"` });
    }
  }
  for (const id of Object.keys(lib.waivers)) {
    if (!contract.functions.has(id)) {
      issues.push({ severity: "error", code: "waiver-unknown-fn", message: `${lib.source}: waiver for unknown contract function "${id}"` });
    }
    if (id in lib.bindings) {
      issues.push({ severity: "error", code: "waiver-and-binding", message: `${lib.source}: "${id}" is both bound and waived` });
    }
  }
  for (const id of Object.keys(lib.knownFailures)) {
    if (!testIds.has(id) && !contract.functions.has(id)) {
      issues.push({ severity: "error", code: "known-failure-unknown", message: `${lib.source}: knownFailures entry "${id}" matches no contract test or function` });
    }
  }
  return issues;
}
