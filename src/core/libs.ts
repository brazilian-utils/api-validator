import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { Contract, Issue, LibConfig } from "./model.js";

const LibSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    language: z.string().min(1),
    repo: z.string().url().optional(),
    branch: z.string().optional(),
    entry: z.string().default("."),
    bindings: z.record(z.string(), z.union([z.string(), z.array(z.string()).min(1)])).default({}),
    ignore: z.array(z.string()).default([]),
    waivers: z.record(z.string(), z.string().min(1)).default({}),
    knownFailures: z.record(z.string(), z.string().min(1)).default({}),
    options: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export function loadLibConfigs(dir: string): LibConfig[] {
  const problems: string[] = [];
  const libs: LibConfig[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const rel = path.join(path.basename(dir), file);
    const raw = YAML.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const parsed = LibSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) problems.push(`${rel}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      continue;
    }
    if (`${parsed.data.name}.yaml` !== file) problems.push(`${rel}: lib "${parsed.data.name}" must live in ${parsed.data.name}.yaml`);
    libs.push({ ...parsed.data, source: rel });
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
