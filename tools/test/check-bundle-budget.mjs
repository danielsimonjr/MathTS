#!/usr/bin/env node
/**
 * Bundle size and tree-shake record for published packages (pre build:prod output).
 *
 *   node tools/test/check-bundle-budget.mjs
 *   node tools/test/check-bundle-budget.mjs --write
 */
import { buildSync } from 'esbuild';
import { readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

const BUDGET_PATH = join(repoRoot, 'tools/test/bundle-budget.json');
const EXPORT_LOCK_PATH = join(repoRoot, 'tools/test/export-lock.json');
const writeMode = process.argv.includes('--write');

/** @param {number} budget @param {number} actual */
export function exceedsTolerance(budget, actual, tolerance) {
  const delta = Math.abs(actual - budget);
  const limit = Math.max(tolerance.bytes, budget * tolerance.ratio);
  return delta > limit;
}

function resolveImportPath(dir, target) {
  if (typeof target === 'string') return join(repoRoot, dir, target);
  const imp = target.import ?? target.default?.import;
  return imp ? join(repoRoot, dir, imp) : null;
}

function firstRuntimeExport(pkgName, sub) {
  const lock = JSON.parse(readFileSync(EXPORT_LOCK_PATH, 'utf8'));
  const entries = lock[pkgName]?.[sub] ?? {};
  for (const [name, meta] of Object.entries(entries)) {
    if (meta.kind === 'type') continue;
    if (meta.kind === 'function') return name;
  }
  for (const name of Object.keys(entries)) {
    if (entries[name].kind !== 'type') return name;
  }
  return null;
}

function sentinelForPackage(pkgName) {
  if (pkgName === '@danielsimonjr/mathts-core') return 'kilogram';
  return null;
}

/**
 * @returns {import('./bundle-budget.json')}
 */
export function measureBudget() {
  const exportLock = JSON.parse(readFileSync(EXPORT_LOCK_PATH, 'utf8'));
  /** @type {Record<string, number>} */
  const files = {};
  /** @type {Record<string, { treeShake: boolean, sentinel?: string, sentinelPresent?: boolean }>} */
  const entries = {};

  for (const dir of workspaceDirs()) {
    const pkg = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
    if (pkg.private) continue;
    const exp = pkg.exports ?? { '.': { import: pkg.main, types: pkg.types } };
    for (const [sub, target] of Object.entries(exp)) {
      if (typeof target !== 'object' || target === null) continue;
      const filePath = resolveImportPath(dir, target);
      if (!filePath || !existsSync(filePath)) continue;
      const rel = filePath.slice(repoRoot.length + 1);
      files[rel] = statSync(filePath).size;

      const exportName = firstRuntimeExport(pkg.name, sub);
      if (!exportName) continue;
      const specifier = sub === '.' ? pkg.name : `${pkg.name}/${sub.slice(2)}`;
      const fixture = `import { ${exportName} } from '${specifier}';\nvoid ${exportName};\n`;
      const entryKey = `${rel}::${exportName}`;
      try {
        const full = readFileSync(filePath, 'utf8').length;
        const result = buildSync({
          stdin: { contents: fixture, loader: 'js', resolveDir: repoRoot },
          bundle: true,
          platform: 'node',
          format: 'esm',
          write: false,
          absWorkingDir: repoRoot,
          logLevel: 'silent',
        });
        const bundled = result.outputFiles[0].text.length;
        const treeShake = bundled <= full * 0.8;
        const sentinel = sentinelForPackage(pkg.name);
        const sentinelPresent = sentinel ? result.outputFiles[0].text.includes(sentinel) : undefined;
        entries[entryKey] = { treeShake, sentinel: sentinel ?? undefined, sentinelPresent };
      } catch {
        entries[entryKey] = { treeShake: false };
      }
    }
    for (const wasmRel of [`${dir}/dist/wasm/mathts-as.wasm`]) {
      const wasmPath = join(repoRoot, wasmRel);
      if (existsSync(wasmPath)) files[wasmRel] = statSync(wasmPath).size;
    }
  }

  return {
    note: 'Bytes of bun run build output, before build:prod. A change beyond the tolerance updates this file in the same PR.',
    tolerance: { bytes: 512, ratio: 0.01 },
    files,
    entries,
  };
}

const live = measureBudget();

if (writeMode) {
  writeFileSync(BUDGET_PATH, `${JSON.stringify(live, null, 2)}\n`);
  console.log(`Wrote ${BUDGET_PATH}`);
  process.exit(0);
}

const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8'));
let failed = false;

for (const [rel, expected] of Object.entries(budget.files)) {
  const actual = live.files[rel];
  if (actual === undefined) {
    console.error(`FAIL: missing built file ${rel}`);
    failed = true;
    continue;
  }
  if (exceedsTolerance(expected, actual, budget.tolerance)) {
    console.error(`FAIL: ${rel} size ${actual} vs budget ${expected}`);
    failed = true;
  }
}

for (const [key, expected] of Object.entries(budget.entries ?? {})) {
  const actual = live.entries?.[key];
  if (!actual) {
    console.error(`FAIL: missing tree-shake entry ${key}`);
    failed = true;
    continue;
  }
  if (expected.treeShake && !actual.treeShake) {
    console.error(`FAIL: ${key} treeShake flipped true -> false`);
    failed = true;
  }
  if (
    expected.treeShake &&
    expected.sentinel &&
    expected.sentinelPresent === false &&
    actual.sentinelPresent
  ) {
    console.error(`FAIL: ${key} sentinel ${expected.sentinel} appeared in tree-shaken bundle`);
    failed = true;
  }
}

if (failed) {
  console.error('Update tools/test/bundle-budget.json in the same PR when deliberate.');
  process.exit(1);
}
console.log('OK: bundle budget and tree-shake record match.');
