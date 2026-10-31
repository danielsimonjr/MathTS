/**
 * Refuse to benchmark when head `src/` is newer than its built dist entry.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packageDotEntry } from '../../package-dot-entry.mjs';
import { repoRoot as defaultRepoRoot, workspaceDirs } from '../../test/workspaces.mjs';

function walkSrcTs(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkSrcTs(p, out);
    else if (ent.isFile() && ent.name.endsWith('.ts') && !ent.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * @param {string} pkgDir absolute package directory under the repo
 * @returns {string | null} error message, or null if ok
 */
export function distFreshnessError(pkgDir) {
  const srcDir = join(pkgDir, 'src');
  if (!existsSync(srcDir)) return null;
  let distPath;
  try {
    ({ distPath } = packageDotEntry(pkgDir));
  } catch {
    return `${pkgDir}: no dist entry`;
  }
  if (!existsSync(distPath)) {
    return `${pkgDir}: dist entry missing (${distPath}). Run bun run build.`;
  }
  const distMtime = statSync(distPath).mtimeMs;
  for (const srcPath of walkSrcTs(srcDir)) {
    if (statSync(srcPath).mtimeMs > distMtime) {
      return `${srcPath} is newer than dist (${distPath}). Rebuild before bench:ab.`;
    }
  }
  return null;
}

/**
 * Check every workspace package, not only the case file's entry package: the head tree is the
 * workspace, and a stale `dist` of any package under the entry (core, matrix, ...) times old code.
 * @param {string} [repoRoot]
 * @returns {string | null} the first error, or null when every dist is fresh
 */
export function preflightWorkspace(repoRoot = defaultRepoRoot) {
  for (const rel of workspaceDirs(repoRoot)) {
    const err = distFreshnessError(resolve(repoRoot, rel));
    if (err) return err;
  }
  return null;
}
