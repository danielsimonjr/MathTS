/**
 * Workspace package directories of the MathTS monorepo, read from the root `package.json`
 * `workspaces` field. A `dir/*` entry expands to every subdirectory that holds a package.json.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the repository root. */
export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/**
 * List the workspace package directories, relative to the repository root.
 * @param {string} [root] repository root; defaults to this checkout (tests pass a fixture)
 * @returns {string[]} directories such as `core` or `packages/workerpool`, in manifest order.
 */
export function workspaceDirs(root = repoRoot) {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  return rootPkg.workspaces.flatMap((entry) => {
    if (!entry.endsWith('/*')) return [entry];
    const parent = entry.slice(0, -2);
    return readdirSync(join(root, parent), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(root, parent, d.name, 'package.json')))
      .map((d) => `${parent}/${d.name}`)
      .sort();
  });
}

/** Published scope for in-repo workspace packages installed as tarballs in consumer harnesses. */
export const MATHTS_WORKSPACE_PREFIX = '@danielsimonjr/mathts-';

/**
 * Map each workspace package name to its directory relative to the repo root.
 *
 * @param {string} [root] - repository root; defaults to this checkout
 * @returns {Map<string, string>} package name to workspace directory path
 */
export function workspacePackageDirsByName(root = repoRoot) {
  /** @type {Map<string, string>} */
  const byName = new Map();
  for (const dir of workspaceDirs(root)) {
    const pkg = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
    if (typeof pkg.name === 'string') byName.set(pkg.name, dir);
  }
  return byName;
}

/**
 * Collects the transitive closure of workspace `dependencies` and `peerDependencies` on `@danielsimonjr/mathts-*`.
 *
 * @param {string[]} seedDirs - workspace dirs the consumer imports (for example `functions`)
 * @param {string} [root] - repository root; defaults to this checkout
 * @returns {string[]} sorted unique workspace directories to pack and install as tarballs
 */
export function workspaceMathtsClosure(seedDirs, root = repoRoot) {
  const byName = workspacePackageDirsByName(root);
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[]} */
  const queue = [...seedDirs];

  while (queue.length > 0) {
    const dir = queue.shift();
    if (dir === undefined || seen.has(dir)) continue;
    seen.add(dir);
    const pkgPath = join(root, dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const field of ['dependencies', 'peerDependencies']) {
      const deps = pkg[field];
      if (deps === null || deps === undefined || typeof deps !== 'object') continue;
      for (const name of Object.keys(deps)) {
        if (!name.startsWith(MATHTS_WORKSPACE_PREFIX)) continue;
        const depDir = byName.get(name);
        if (depDir === undefined) {
          throw new Error(
            `workspaceMathtsClosure: ${pkg.name} ${field} lists ${name} but it is not a workspace package`
          );
        }
        if (!seen.has(depDir)) queue.push(depDir);
      }
    }
  }
  return [...seen].sort();
}
