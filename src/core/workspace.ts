import fs from "node:fs";
import path from "node:path";
import type { AdapterContext, LanguageAdapter } from "../languages/types.js";
import { getAdapter } from "../languages/registry.js";
import type { LibConfig } from "./model.js";
import { CACHE_DIR, REPOS_DIR } from "./paths.js";
import { git } from "./shell.js";

export interface LibWorkspace {
  lib: LibConfig;
  adapter: LanguageAdapter;
  root: string;
  workDir: string;
  /** What adapters take: the lib, its root and its work dir. */
  ctx: AdapterContext;
}

/** Where a lib lives: an explicit `--path` (a lib's own CI) or the synced clone. */
export function workspaceFor(lib: LibConfig, explicitPath?: string): LibWorkspace {
  const root = path.resolve(explicitPath ?? path.join(REPOS_DIR, lib.name));
  if (!fs.existsSync(root)) {
    throw new Error(`${lib.name}: checkout not found at ${root}. Run \`docs sync\` or pass --path.`);
  }
  const workDir = path.join(CACHE_DIR, lib.name);
  fs.mkdirSync(workDir, { recursive: true });
  return { lib, adapter: getAdapter(lib.language), root, workDir, ctx: { lib, root, workDir } };
}

export function syncRepo(lib: LibConfig, opts: { branch?: string; shallow?: boolean } = {}): void {
  if (!lib.repo) throw new Error(`${lib.name}: no repo configured`);
  const dir = path.join(REPOS_DIR, lib.name);
  const branch = opts.branch ?? lib.branch;
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
    git(["clone", ...(opts.shallow === false ? [] : ["--depth", "1"]), ...(branch ? ["--branch", branch] : []), lib.repo, dir]);
    return;
  }
  git(["fetch", "--prune", ...(opts.shallow === false ? [] : ["--depth", "1"]), "origin", ...(branch ? [branch] : [])], dir);
  git(["reset", "--hard", "FETCH_HEAD"], dir);
}
