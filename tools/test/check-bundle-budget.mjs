#!/usr/bin/env node
/**
 * Bundle size and tree-shake record for published packages.
 *
 * Measures the output of `bun run build` (before `build:prod`, which rewrites `dist/`):
 *   - `files`: bytes of each file an `exports[subpath].import` names, plus every file it reaches
 *     through static relative imports. `core` ships a 36 KB `index.js` that imports a 164 KB
 *     hash-named chunk; the entry alone would miss that chunk. A `.wasm` entry is its own size.
 *   - `entries`: whether a one-name import tree-shakes. esbuild bundles the entry file once whole
 *     and once through `import { <first runtime function> } from '<entry>'`; the second is
 *     `treeShake: true` when it is at most 80% of the first. Other packages stay external, so a
 *     package is measured by its own code, not by the packages it depends on. `sentinel` is a
 *     string from a different export (`kilogram` for `core`); `sentinelPresent` says whether the
 *     one-name bundle still carries it.
 *
 *   node tools/test/check-bundle-budget.mjs            compare, exit 1 on drift
 *   node tools/test/check-bundle-budget.mjs --write    refresh after a deliberate size change
 * `--root <dir>`, `--budget <file>` and `--lock <file>` point it at a fixture.
 */
import { buildSync } from 'esbuild';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { staticImports } from './dist-node-imports.mjs';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

const TOLERANCE = { bytes: 512, ratio: 0.01 };
const TREE_SHAKE_RATIO = 0.8;
const SENTINELS = { '@danielsimonjr/mathts-core': 'kilogram' };

/**
 * @param {number} budget
 * @param {number} actual
 * @param {{ bytes: number, ratio: number }} tolerance
 */
export function exceedsTolerance(budget, actual, tolerance) {
  return Math.abs(actual - budget) > Math.max(tolerance.bytes, budget * tolerance.ratio);
}

/**
 * Files an entry loads statically: itself and everything it reaches by relative import.
 * @param {string} entry absolute path of a `.js` entry
 * @returns {string[]}
 */
export function staticClosure(entry) {
  const seen = new Set();
  const queue = [resolve(entry)];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!file.endsWith('.js')) continue;
    for (const specifier of staticImports(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      const target = resolve(dirname(file), specifier);
      if (!existsSync(target))
        throw new Error(`${file} imports ${specifier}; ${target} is missing`);
      queue.push(target);
    }
  }
  return [...seen];
}

/** @param {Record<string, any>} entries lock entries of one subpath */
function firstRuntimeFunction(entries) {
  return Object.keys(entries).find((name) => entries[name].kind === 'function') ?? null;
}

/** @param {string} root @param {string} entry @param {string | null} exportName */
function bundleText(root, entry, exportName) {
  const common = {
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    write: false,
    logLevel: 'silent',
    absWorkingDir: root,
  };
  const result = exportName
    ? buildSync({
        ...common,
        stdin: {
          contents: `import { ${exportName} } from ${JSON.stringify(entry)};\nvoid ${exportName};\n`,
          loader: 'js',
          resolveDir: dirname(entry),
        },
      })
    : buildSync({ ...common, entryPoints: [entry] });
  return result.outputFiles[0].text;
}

/**
 * Measure every non-private workspace package under `root`.
 * @param {string} root
 * @param {Record<string, Record<string, Record<string, { kind: string }>>>} lock export lock tree
 */
export function measureBudget(root, lock) {
  /** @type {Record<string, number>} */
  const files = {};
  /** @type {Record<string, { export: string, treeShake: boolean, sentinel?: string, sentinelPresent?: boolean }>} */
  const entries = {};

  for (const dir of workspaceDirs(root)) {
    const pkg = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
    if (pkg.private) continue;
    const exp = pkg.exports ?? { '.': { import: pkg.main, types: pkg.types } };

    for (const [sub, target] of Object.entries(exp)) {
      const importPath =
        typeof target === 'string' ? target : (target?.import ?? target?.default?.import);
      if (typeof importPath !== 'string') continue;
      const entry = join(root, dir, importPath);
      if (!existsSync(entry)) continue;
      const rel = relative(root, entry).split('\\').join('/');
      files[rel] = staticClosure(entry).reduce((sum, file) => sum + statSync(file).size, 0);

      const exportName = firstRuntimeFunction(lock[pkg.name]?.[sub] ?? {});
      if (!exportName || !entry.endsWith('.js')) continue;
      const whole = bundleText(root, entry, null);
      const one = bundleText(root, entry, exportName);
      const sentinel = sub === '.' ? SENTINELS[pkg.name] : undefined;
      entries[rel] = {
        export: exportName,
        treeShake: one.length <= whole.length * TREE_SHAKE_RATIO,
        ...(sentinel ? { sentinel, sentinelPresent: one.includes(sentinel) } : {}),
      };
    }

    const wasm = join(root, dir, 'dist/wasm/mathts-as.wasm');
    if (existsSync(wasm)) files[relative(root, wasm).split('\\').join('/')] = statSync(wasm).size;
  }
  return { files, entries };
}

/**
 * List how a fresh measurement differs from the committed budget.
 * @param {ReturnType<typeof measureBudget>} live
 * @param {{ tolerance: { bytes: number, ratio: number }, files: Record<string, number>, entries: Record<string, any> }} budget
 * @returns {string[]} empty when they agree
 */
export function compareBudget(live, budget) {
  /** @type {string[]} */
  const failures = [];
  if (JSON.stringify(budget.tolerance) !== JSON.stringify(TOLERANCE)) {
    failures.push(`tolerance must stay ${JSON.stringify(TOLERANCE)}`);
  }

  for (const [file, expected] of Object.entries(budget.files)) {
    const actual = live.files[file];
    if (actual === undefined) failures.push(`${file}: in the budget but not built`);
    else if (exceedsTolerance(expected, actual, budget.tolerance)) {
      failures.push(`${file}: ${actual} bytes, budget ${expected}`);
    }
  }
  for (const file of Object.keys(live.files)) {
    if (!(file in budget.files)) failures.push(`${file}: built but not in the budget`);
  }

  for (const [file, expected] of Object.entries(budget.entries)) {
    const actual = live.entries[file];
    if (!actual) {
      failures.push(`${file}: tree-shake entry in the budget but not measured`);
      continue;
    }
    if (expected.treeShake && !actual.treeShake) {
      failures.push(`${file}: treeShake flipped true -> false (importing ${actual.export})`);
    } else if (!expected.treeShake && actual.treeShake) {
      failures.push(`${file}: treeShake improved false -> true; record it in the budget`);
    }
    if (expected.treeShake && actual.sentinelPresent && !expected.sentinelPresent) {
      failures.push(`${file}: sentinel ${actual.sentinel} appeared in the one-name bundle`);
    }
  }
  for (const file of Object.keys(live.entries)) {
    if (!(file in budget.entries)) failures.push(`${file}: measured but not in the budget`);
  }
  return failures;
}

/** @param {string[]} args @param {string} flag */
function flagValue(args, flag) {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
}

/** @param {string[]} args */
export function main(args) {
  const root = resolve(flagValue(args, '--root') ?? repoRoot);
  const budgetPath = resolve(
    flagValue(args, '--budget') ?? join(root, 'tools/test/bundle-budget.json')
  );
  const lockPath = resolve(flagValue(args, '--lock') ?? join(root, 'tools/test/export-lock.json'));
  const live = measureBudget(root, JSON.parse(readFileSync(lockPath, 'utf8')));

  if (args.includes('--write')) {
    const budget = {
      note: 'Bytes of bun run build output, before build:prod: each exports[].import file plus the files it statically imports. A change beyond the tolerance updates this file in the same PR.',
      tolerance: TOLERANCE,
      ...live,
    };
    writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
    console.log(`Wrote ${budgetPath}`);
    return 0;
  }

  if (!existsSync(budgetPath)) {
    console.error(`Missing ${budgetPath}. Run with --write after bun run build.`);
    return 1;
  }
  const failures = compareBudget(live, JSON.parse(readFileSync(budgetPath, 'utf8')));
  if (failures.length > 0) {
    console.error('FAIL: bundle budget differs from tools/test/bundle-budget.json:');
    for (const line of failures) console.error(`  ${line}`);
    console.error('If deliberate, refresh with: node tools/test/check-bundle-budget.mjs --write');
    return 1;
  }
  console.log(
    `OK: ${Object.keys(live.files).length} files and ${Object.keys(live.entries).length} tree-shake entries match the budget.`
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
