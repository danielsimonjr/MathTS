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
 * @returns {string[]} directories such as `core` or `packages/workerpool`, in manifest order.
 */
export function workspaceDirs() {
  const rootPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  return rootPkg.workspaces.flatMap((entry) => {
    if (!entry.endsWith('/*')) return [entry];
    const parent = entry.slice(0, -2);
    return readdirSync(join(repoRoot, parent), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(repoRoot, parent, d.name, 'package.json')))
      .map((d) => `${parent}/${d.name}`)
      .sort();
  });
}
