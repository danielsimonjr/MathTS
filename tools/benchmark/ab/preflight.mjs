/**
 * Refuse to benchmark when head `src/` is newer than its built dist entry.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
 * @param {string} entryPackage npm name such as @danielsimonjr/mathts-functions
 * @param {string} [repoRoot]
 * @returns {string | null}
 */
export function preflightEntryPackage(entryPackage, repoRoot = defaultRepoRoot) {
  for (const rel of workspaceDirs(repoRoot)) {
    const pkgDir = resolve(repoRoot, rel);
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    if (pkg.name === entryPackage) {
      return distFreshnessError(pkgDir);
    }
  }
  return `unknown entry package ${entryPackage}`;
}
