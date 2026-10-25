/**
 * Resolve a package.json `.` entry. Shared by the dist-freshness preflight
 * (`import`-first: the Node/Bun namespace we name-check) and the dist builtin
 * scanner (`browser`-first: the file a bundler loads).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Condition order a browser bundler tries. */
export const BROWSER_EXPORT_KEYS = ['browser', 'import', 'module', 'default'];

/** Condition order for the Node/Bun `.` import the docs generator loads. */
export const IMPORT_EXPORT_KEYS = ['import', 'module', 'default'];

/**
 * Pick the file that a package.json `exports` condition names.
 * @param {unknown} value an `exports` condition value
 * @param {string[]} keys condition names in preference order
 * @returns {string | null}
 */
export function pickCondition(value, keys) {
  if (typeof value === 'string') return value;
  if (value === null || typeof value !== 'object') return null;
  for (const key of keys) {
    const picked = pickCondition(value[key], keys);
    if (picked !== null) return picked;
  }
  return null;
}

/**
 * Resolve the `.` entry file for a package directory.
 * @param {string} pkgDir directory that holds the package.json
 * @param {string[]} [keys] `exports` condition order
 * @returns {{ pkgName: string, distPath: string }}
 */
export function packageDotEntry(pkgDir, keys = IMPORT_EXPORT_KEYS) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const target = pickCondition(pkg.exports?.['.'], keys) ?? pkg.module ?? pkg.main;
  if (typeof target !== 'string') {
    throw new Error(`${pkgDir}: package.json has no "." entry`);
  }
  return { pkgName: pkg.name, distPath: resolve(pkgDir, target) };
}
