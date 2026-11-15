/**
 * Load a real second copy of a built workspace package, for cross-copy tests (#1033, #1041).
 *
 * A module runtime loads one copy per file URL. The functions copy the `dist` folder of a package to
 * a new folder under the `node_modules/.cross-copy` folder of that package, and import the copy. The
 * copy has its own classes (for core: `Complex`, `Fraction`, `BigNumber`, `Dual`; for matrix:
 * `DenseMatrix`, `SparseMatrix`). Its bare imports resolve as the imports of the package do, so it
 * shares every other package with the first copy. A copy under the root `node_modules` does not work
 * under bun test: there the root `tsconfig.json` paths resolve a bare import to the sources of a
 * package. The method works under both bun test and vitest, because it uses no API of the test
 * runner.
 *
 * The `test` task of turbo builds the dependencies of a package first, so the `dist` folder exists
 * when a test calls a function.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Import a second copy of the bundle of a workspace package.
 *
 * @param {string} packageDir The folder of the package, relative to the repository root (for example `matrix`).
 * @param {string} name A folder name for the copy. Use one name per test file, so parallel files do not share a folder.
 * @returns {Promise<Record<string, unknown>>} The module namespace of the copy.
 */
export async function importSecondPackageCopy(packageDir, name) {
  const source = join(ROOT, packageDir, 'dist');
  if (!existsSync(join(source, 'index.js'))) {
    throw new Error(`second-package-copy: ${source} has no index.js; build ${packageDir} first`);
  }
  const target = join(ROOT, packageDir, 'node_modules', '.cross-copy', name);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  return import(pathToFileURL(join(target, 'index.js')).href);
}

/**
 * Import a second copy of the core bundle.
 *
 * @param {string} name A folder name for the copy. Use one name per test file, so parallel files do not share a folder.
 * @returns {Promise<Record<string, unknown>>} The module namespace of the copy.
 */
export function importSecondCoreCopy(name) {
  return importSecondPackageCopy('core', name);
}
