#!/usr/bin/env node
/**
 * Sync published-package packaging metadata (G29): LICENSE on disk + in `files`,
 * homepage/bugs, `exports["./package.json"]`, and honest `sideEffects`.
 *
 *   node tools/sync-package-packaging.mjs --write     apply package.json + copy LICENSE
 *   node tools/sync-package-packaging.mjs --check     exit 1 when out of sync
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './test/workspaces.mjs';

const HOMEPAGE = 'https://github.com/danielsimonjr/MathTS#readme';
const BUGS = { url: 'https://github.com/danielsimonjr/MathTS/issues' };
const ROOT_LICENSE = join(repoRoot, 'LICENSE');

/** @type {ReadonlySet<string>} */
const SIDE_EFFECT_FREE = new Set([
  'parser',
  'ast',
  'evaluator',
  'units',
  'numbers',
  'linalg',
  'arithmetic',
  'trigonometry',
  'statistics',
  'signal',
  'gpu',
]);

const args = process.argv.slice(2);
const write = args.includes('--write');
const check = args.includes('--check');
if (!write && !check) {
  console.error('sync-package-packaging: pass --write or --check');
  process.exit(2);
}

/**
 * Whether a workspace package may declare `sideEffects: false`.
 * @param {string} dir workspace directory
 * @returns {boolean}
 */
function expectedSideEffects(dir) {
  const base = dir.includes('/') ? dir.split('/').pop() : dir;
  return SIDE_EFFECT_FREE.has(base) ? false : true;
}

/**
 * True when the package manifest lists LICENSE in `files`.
 * @param {Record<string, unknown>} filesField
 * @returns {boolean}
 */
function filesIncludesLicense(filesField) {
  const files = Array.isArray(filesField) ? filesField : [];
  return files.includes('LICENSE');
}

/**
 * True when the package exports its own package.json subpath.
 * @param {Record<string, unknown>} pkg
 * @returns {boolean}
 */
function exportsHasPackageJson(pkg) {
  const exp = pkg.exports;
  if (!exp || typeof exp !== 'object') return false;
  const entry = exp['./package.json'];
  return entry === './package.json' || (typeof entry === 'object' && entry?.default === './package.json');
}

/**
 * Packaging fields that still differ from the G29 expected shape.
 * @returns {string[]}
 */
function collectProblems(dir, pkg) {
  const problems = [];
  if (pkg.private) return problems;
  if (pkg.homepage !== HOMEPAGE) problems.push('homepage');
  if (JSON.stringify(pkg.bugs) !== JSON.stringify(BUGS)) problems.push('bugs');
  if (!filesIncludesLicense(pkg.files)) problems.push('files/LICENSE');
  if (!existsSync(join(repoRoot, dir, 'LICENSE'))) problems.push('missing LICENSE file');
  if (!exportsHasPackageJson(pkg)) problems.push('exports["./package.json"]');
  const wantSe = expectedSideEffects(dir);
  if (pkg.sideEffects !== wantSe) problems.push(`sideEffects (want ${wantSe})`);
  return problems;
}

const dirs = workspaceDirs();
let anyProblems = false;

for (const dir of dirs) {
  const pkgPath = join(repoRoot, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.private) continue;

  const problems = collectProblems(dir, pkg);
  if (problems.length === 0) continue;
  anyProblems = true;

  if (check) {
    console.error(`sync-package-packaging: ${dir}/package.json: ${problems.join(', ')}`);
    continue;
  }

  pkg.homepage = HOMEPAGE;
  pkg.bugs = { ...BUGS };
  const files = new Set(Array.isArray(pkg.files) ? pkg.files : []);
  files.add('LICENSE');
  pkg.files = [...files];
  if (!pkg.exports || typeof pkg.exports !== 'object') pkg.exports = { '.': { import: pkg.main, types: pkg.types } };
  pkg.exports['./package.json'] = './package.json';
  pkg.sideEffects = expectedSideEffects(dir);

  if (pkg.tsdown && typeof pkg.tsdown === 'object' && pkg.tsdown.sourcemap !== true) {
    pkg.tsdown = { ...pkg.tsdown, sourcemap: true };
  }

  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  copyFileSync(ROOT_LICENSE, join(repoRoot, dir, 'LICENSE'));
  console.log(`sync-package-packaging: updated ${dir}`);
}

if (check && anyProblems) process.exit(1);
if (check && !anyProblems) console.log('sync-package-packaging: check OK');
