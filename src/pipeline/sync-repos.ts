import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { ensureDir } from "../utils/fs.js";
import { REPOS_DIR } from "../utils/paths.js";
import { runCommand } from "../utils/shell.js";
import type { LibraryConfig } from "../types.js";

export interface SyncOptions {
  branchOverride?: string;
  shallow?: boolean;
}

function resolveRemoteDefaultBranch(repoDir: string): string | undefined {
  try {
    const raw = execSync("git symbolic-ref --short refs/remotes/origin/HEAD", {
      cwd: repoDir,
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
    return raw.replace(/^origin\//, "");
  } catch {
    try {
      const refs = execSync("git for-each-ref --format='%(refname:short)' refs/remotes/origin", {
        cwd: repoDir,
        stdio: ["ignore", "pipe", "ignore"]
      })
        .toString()
        .split("\n")
        .map((line) => line.trim().replace(/^'|'$/g, ""))
        .filter((line) => line && !line.endsWith("/HEAD"))
        .map((line) => line.replace(/^origin\//, ""));

      if (refs.includes("main")) return "main";
      if (refs.includes("master")) return "master";
      return refs[0];
    } catch {
      return undefined;
    }
  }
}

export function syncRepositories(libs: LibraryConfig[], options: SyncOptions = {}): void {
  ensureDir(REPOS_DIR);

  for (const lib of libs) {
    const targetDir = path.join(REPOS_DIR, lib.name);
    const branch = options.branchOverride ?? lib.branch;

    if (!fs.existsSync(targetDir)) {
      const depthFlag = options.shallow ? "--depth 1" : "";
      const branchFlag = branch ? `--branch ${branch}` : "";
      runCommand(`git clone ${depthFlag} ${branchFlag} ${lib.repo} ${targetDir}`.replace(/\s+/g, " ").trim());
      continue;
    }

    runCommand("git fetch --all --prune", targetDir);
    const targetBranch = branch ?? resolveRemoteDefaultBranch(targetDir);

    if (!targetBranch) {
      // If no remote branch can be resolved, we already fetched and move on deterministically.
      continue;
    }

    try {
      runCommand(`git checkout ${targetBranch}`, targetDir);
    } catch {
      runCommand(`git checkout -b ${targetBranch} --track origin/${targetBranch}`, targetDir);
    }

    runCommand(`git pull origin ${targetBranch}`, targetDir);
  }
}
