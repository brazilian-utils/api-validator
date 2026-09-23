import { execFileSync } from 'node:child_process';

const git = (...args: string[]) => execFileSync('git', args, { cwd: '..', stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

// A shallow clone (Vercel's) has lost the commits that last touched most files: `git log` would
// name the oldest commit it has, a wrong date. There, no date at all.
let shallow: boolean | undefined;
const isShallow = () => {
  try {
    return (shallow ??= git('rev-parse', '--is-shallow-repository') === 'true');
  } catch {
    return (shallow = true);
  }
};

/** Date of the last commit that touched a file (paths from the repository root), or undefined. */
export function lastCommit(...files: string[]): Date | undefined {
  if (isShallow()) return undefined;
  try {
    const out = git('log', '-1', '--format=%cI', '--', ...files);
    return out ? new Date(out) : undefined;
  } catch {
    return undefined;
  }
}
