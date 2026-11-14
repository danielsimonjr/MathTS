/**
 * Load a real second copy of the built `@danielsimonjr/mathts-core` bundle, for cross-copy tests (#1033).
 *
 * A module runtime loads one copy per file URL. The function copies `core/dist` to a new folder under
 * `node_modules/.cross-copy`, and imports the copy. The copy has its own `Complex`, `Fraction`,
 * `BigNumber` and `Dual` classes. Its bare imports resolve from the `node_modules` of the repository.
 * The method works under both bun test and vitest, because it uses no API of the test runner.
 *
 * The `test` task of turbo builds core first, so `core/dist` exists when a test calls the function.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(ROOT, 'core', 'dist');
const COPIES = join(ROOT, 'node_modules', '.cross-copy');

/**
 * Import a second copy of the core bundle.
 *
 * @param {string} name A folder name for the copy. Use one name per test file, so parallel files do not share a folder.
 * @returns {Promise<Record<string, unknown>>} The module namespace of the copy.
 */
export async function importSecondCoreCopy(name) {
  if (!existsSync(join(SOURCE, 'index.js'))) {
    throw new Error(`second-core-copy: ${SOURCE} has no index.js; build core first`);
  }
  const target = join(COPIES, name);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(SOURCE, target, { recursive: true });
  return import(pathToFileURL(join(target, 'index.js')).href);
}
