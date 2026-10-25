/**
 * Find the Node builtin modules that a built dist entry imports statically.
 *
 * A browser bundler replaces a Node builtin with a stub that throws on first use, and a
 * module-level `createRequire(import.meta.url)` uses it while the module loads. So one static
 * import of a builtin anywhere in a package entry's import graph can break every page that
 * loads the package. A dynamic `import()` stays lazy, so the scan ignores it, and so it ignores
 * a file that the entry does not reach (a separate `./render` subpath export, for example).
 *
 * `tsup` left no such import in `packages/workerpool`. `tsdown` added `import { createRequire }
 * from "node:module"` because the source called `require('os')` inside an ES module.
 *
 * The scan reads text. The dist is one bundler's plain ESM output, and the unit tests pin the
 * forms that it emits.
 */
import { existsSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, resolve } from 'node:path';
import { BROWSER_EXPORT_KEYS, packageDotEntry } from '../package-dot-entry.mjs';

const BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));

/**
 * One static import or re-export, in plain or minified form. The first group is the specifier.
 * `import(` and `import.meta` are not static imports, so a lookahead rejects them.
 */
const STATIC_IMPORT =
  /(?:^|[;}\n])[ \t]*(?:import|export)\b(?!\s*[.(])\s*(?:[^"';]*?\bfrom\s*)?["']([^"']+)["']/g;

/**
 * Tell whether a module specifier names a Node builtin.
 * @param {string} specifier an import specifier, such as `node:module` or `fs/promises`
 * @returns {boolean} true for a `node:` specifier or a bare builtin name
 */
export function isNodeBuiltin(specifier) {
  return specifier.startsWith('node:') || BUILTINS.has(specifier);
}

/**
 * List the specifiers that a module imports or re-exports statically.
 * @param {string} source the module text
 * @returns {string[]} specifiers in source order
 */
export function staticImports(source) {
  return Array.from(source.matchAll(STATIC_IMPORT), (match) => match[1]);
}

/**
 * Follow the static, relative imports from an entry file and collect each builtin import.
 * A relative import with no file throws: a dist that cannot load is not browser-safe.
 * @param {string} entry path of the entry file
 * @returns {{file: string, specifier: string}[]} one record per builtin import
 */
export function staticNodeImports(entry) {
  const found = [];
  const seen = new Set();
  const queue = [resolve(entry)];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of staticImports(readFileSync(file, 'utf8'))) {
      if (isNodeBuiltin(specifier)) {
        found.push({ file, specifier });
      } else if (specifier.startsWith('.')) {
        const target = resolve(dirname(file), specifier);
        if (!existsSync(target)) {
          throw new Error(`${file} imports ${specifier}, and ${target} does not exist`);
        }
        queue.push(target);
      }
    }
  }
  return found;
}

/**
 * Resolve the file of a package's `.` entry (browser condition first).
 * @param {string} packageDir directory that holds the package.json
 * @returns {string} absolute path of the entry file
 */
export function dotEntryFile(packageDir) {
  return packageDotEntry(packageDir, BROWSER_EXPORT_KEYS).distPath;
}
