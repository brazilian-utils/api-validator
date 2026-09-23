import { execFileSync } from 'node:child_process';

/** Date of the last commit that touched a file (paths from the repository root), or undefined. */
export function lastCommit(...files: string[]): Date | undefined {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...files], { cwd: '..', stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return out ? new Date(out) : undefined;
  } catch {
    return undefined;
  }
}
