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
 *   - `bundles`: the minified size of what a user's bundler emits for one import line, packages
 *     inlined (not external). `functions/evaluate` resolves any function name in an expression,
 *     so it needs the whole function table; its size equals the barrel's within 1 percent
 *     (dogfood #930), and the compat shim carries the same table. Each case lists its import
 *     line, platform and ceiling in the budget file; `--write` keeps the list and refreshes it.
 * `--root <dir>`, `--budget <file>` and `--lock <file>` point it at a fixture.
 *
 * The budget is a per-entry CEILING, not an exact byte count. Two parallel PRs that each touch
 * output sizes used to regenerate this file with exact bytes and conflict on every such edit;
 * a ceiling leaves headroom, so ordinary size wiggles change no line and PRs rarely touch the
 * file at all. `ceilingFor` rounds the measured size up to the next multiple of a step that
 * scales with the size (2% rounded to a power of two, at least 256 bytes), so the guaranteed
 * detection threshold of a growth stays near 2% + one step and a real regression still fails
 * CI. A shrink never fails: a smaller output is an improvement, and pinning it would put the
 * exact-byte conflict back. The structural checks keep their strength: a file that appears or
 * disappears, a tree-shake flip and a sentinel returning all fail, in both directions.
 */
import { buildSync } from 'esbuild';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { staticImports } from './dist-node-imports.mjs';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

const TREE_SHAKE_RATIO = 0.8;
const SENTINELS = { '@danielsimonjr/mathts-core': 'kilogram' };

/**
 * The byte ceiling recorded for a measured size: the next multiple of a step
 * strictly above the size, where the step is 2% of the size rounded to a power
 * of two (at least 256 bytes). `ceiling - bytes` is between 1 and one step, so
 * a growth beyond the ceiling always fails and the recorded value survives
 * ordinary wiggle.
 * @param {number} bytes
 * @returns {number}
 */
export function ceilingFor(bytes) {
  const scaled = Math.max(bytes * 0.02, 1);
  const step = Math.max(256, 2 ** Math.round(Math.log2(scaled)));
  return Math.ceil((bytes + 1) / step) * step;
}

/**
 * Is true when the actual size no longer fits the ceiling.
 * @param {number} ceiling
 * @param {number} actual
 */
export function exceedsCeiling(ceiling, actual) {
  return actual > ceiling;
}

/** Largest shrink ratio between implied recorded size and live size before a ceiling is rejected as hand-loosened. */
const MAX_IMPLIED_SHRINK_RATIO = 10;

/**
 * Smallest byte size whose {@link ceilingFor} value equals `ceiling`.
 * @param {number} ceiling
 * @returns {number}
 */
export function minimumBytesForCeiling(ceiling) {
  let lo = 0;
  let hi = ceiling;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ceilingFor(mid) < ceiling) lo = mid + 1;
    else hi = mid;
  }
  while (lo > 0 && ceilingFor(lo - 1) === ceiling) lo--;
  return lo;
}

/**
 * Returns a failure message when `maxBytes` is not `ceilingFor` of the size it was written from.
 * @param {string} label
 * @param {number} maxBytes
 * @param {number} actual
 * @returns {string | null}
 */
export function loosenedCeilingFailure(label, maxBytes, actual) {
  if (actual > maxBytes) return null;
  const tight = ceilingFor(actual);
  if (maxBytes <= tight) return null;
  const recorded = minimumBytesForCeiling(maxBytes);
  if (ceilingFor(recorded) !== maxBytes) {
    if (maxBytes / tight > MAX_IMPLIED_SHRINK_RATIO) {
      return `${label}: ceiling ${maxBytes} looser than ceilingFor(${actual})=${tight}`;
    }
    return null;
  }
  if (recorded <= actual) {
    return `${label}: ceiling ${maxBytes} must be ceilingFor(${actual})=${tight}`;
  }
  return null;
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

/**
 * Returns the name of the first function export in the lock entries, or null.
 * @param {Record<string, any>} entries lock entries of one subpath
 */
function firstRuntimeFunction(entries) {
  return Object.keys(entries).find((name) => entries[name].kind === 'function') ?? null;
}

/**
 * Bundles an entry, or one export of it, with esbuild and returns the output text.
 * @param {string} root
 * @param {string} entry
 * @param {string | null} exportName
 */
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

/** Import lines measured when the budget file has no `bundles` list yet. */
export const DEFAULT_BUNDLES = [
  {
    label: 'functions/evaluate',
    import: "import { evaluate } from '@danielsimonjr/mathts-functions/evaluate';",
    platform: 'node',
  },
  {
    label: 'functions/evaluate three names',
    import:
      "import { evaluate, parse, compileExpr } from '@danielsimonjr/mathts-functions/evaluate';",
    platform: 'node',
  },
  {
    label: 'functions barrel evaluate',
    import: "import { evaluate } from '@danielsimonjr/mathts-functions';",
    platform: 'node',
  },
  {
    label: 'expression evaluate',
    import: "import { evaluate } from '@danielsimonjr/mathts-expression';",
    platform: 'node',
  },
  {
    label: 'compat create(all)',
    import: "import { create, all } from '@danielsimonjr/mathts-compat';",
    platform: 'node',
  },
  {
    label: 'compat create(all) browser',
    import: "import { create, all } from '@danielsimonjr/mathts-compat';",
    platform: 'browser',
  },
];

/**
 * Minified size of one import line, with every package inlined.
 * @param {string} root
 * @param {{ import: string, platform: 'node' | 'browser' }} bundle
 * @returns {number}
 */
function bundleBytes(root, bundle) {
  const names = [...bundle.import.matchAll(/import\s*\{([^}]+)\}/g)].flatMap((m) =>
    m[1].split(',').map((part) =>
      part
        .trim()
        .split(/\s+as\s+/i)
        .pop()
    )
  );
  const result = buildSync({
    stdin: {
      contents: `${bundle.import}
globalThis.__keep = [${names.join(', ')}];
`,
      loader: 'js',
      resolveDir: root,
    },
    bundle: true,
    minify: true,
    platform: bundle.platform,
    format: 'esm',
    write: false,
    logLevel: 'silent',
    absWorkingDir: root,
    metafile: true,
  });
  const dups = duplicateInstalls(root, Object.keys(result.metafile.inputs));
  if (dups.length > 0) {
    const lines = dups.map((d) => `  ${d.name}@${d.version}: ${d.dirs.join(', ')}`).join('\n');
    throw new Error(
      `bundle "${bundle.import}" inlines a package from more than one install folder:\n${lines}\n` +
        'A nested copy that bun.lock does not name is stale; remove it, then run bun install.'
    );
  }
  return result.outputFiles[0].contents.length;
}

/**
 * Packages that a bundle inlines from two or more install folders at the same version. Such a copy
 * is stale: a nested `node_modules` that the lock no longer names, which `bun install` does not
 * remove. The bundle inlines each copy, so the bundle grows by one copy and no longer matches CI.
 * Two different versions of one name can be correct, so the report names only equal versions.
 * @param {string} root
 * @param {string[]} inputs metafile input paths, relative to `root`
 * @returns {{ name: string, version: string, dirs: string[] }[]}
 */
export function duplicateInstalls(root, inputs) {
  /** @type {Map<string, Set<string>>} */
  const dirsByName = new Map();
  for (const input of inputs) {
    const path = input.replaceAll('\\', '/');
    const m = path.match(/^(.*?node_modules\/(@[^/]+\/[^/]+|[^/@][^/]*))\//);
    if (!m) continue;
    const name = m[2];
    if (!dirsByName.has(name)) dirsByName.set(name, new Set());
    dirsByName.get(name).add(m[1]);
  }
  const out = [];
  for (const [name, dirs] of dirsByName) {
    if (dirs.size < 2) continue;
    /** @type {Map<string, string[]>} */
    const byVersion = new Map();
    for (const dir of dirs) {
      const manifest = join(root, dir, 'package.json');
      const version = existsSync(manifest)
        ? String(JSON.parse(readFileSync(manifest, 'utf8')).version)
        : '?';
      byVersion.set(version, [...(byVersion.get(version) ?? []), dir]);
    }
    for (const [version, list] of byVersion) {
      if (list.length > 1) out.push({ name, version, dirs: list.sort() });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Measure every non-private workspace package under `root`.
 * @param {string} root
 * @param {Record<string, Record<string, Record<string, { kind: string }>>>} lock export lock tree
 */
export function measureBudget(root, lock, bundleCases = []) {
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
  const bundles = bundleCases.map((bundle) => ({ ...bundle, bytes: bundleBytes(root, bundle) }));
  return { files, entries, bundles };
}

/**
 * List how a fresh measurement differs from the committed budget.
 * @param {ReturnType<typeof measureBudget>} live
 * @param {{ files: Record<string, number>, entries: Record<string, any>, bundles?: { label: string, maxBytes: number }[] }} budget
 * @returns {string[]} empty when they agree
 */
export function compareBudget(live, budget) {
  /** @type {string[]} */
  const failures = [];

  for (const [file, ceiling] of Object.entries(budget.files)) {
    const actual = live.files[file];
    if (actual === undefined) failures.push(`${file}: in the budget but not built`);
    else {
      if (exceedsCeiling(ceiling, actual)) {
        failures.push(`${file}: ${actual} bytes, ceiling ${ceiling}`);
      }
      const loosened = loosenedCeilingFailure(file, ceiling, actual);
      if (loosened) failures.push(loosened);
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

  const liveBundles = new Map((live.bundles ?? []).map((b) => [b.label, b]));
  const budgetBundleLabels = new Set();
  for (const expected of budget.bundles ?? []) {
    budgetBundleLabels.add(expected.label);
    const liveBundle = liveBundles.get(expected.label);
    if (!liveBundle)
      failures.push(`bundle ${expected.label}: in the budget but not measured`);
    else if (expected.maxBytes === undefined) {
      failures.push(`bundle ${expected.label}: missing maxBytes ceiling`);
    } else {
      const actual = liveBundle.bytes;
      if (exceedsCeiling(expected.maxBytes, actual)) {
        failures.push(`bundle ${expected.label}: ${actual} bytes, ceiling ${expected.maxBytes}`);
      }
      const loosened = loosenedCeilingFailure(
        `bundle ${expected.label}`,
        expected.maxBytes,
        actual
      );
      if (loosened) failures.push(loosened);
    }
  }
  for (const liveBundle of live.bundles ?? []) {
    if (!budgetBundleLabels.has(liveBundle.label)) {
      failures.push(`bundle ${liveBundle.label}: measured but not in the budget`);
    }
  }
  return failures;
}

/**
 * Returns the argument that follows a flag, or undefined when the flag is not given.
 * @param {string[]} args
 * @param {string} flag
 */
function flagValue(args, flag) {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
}

/**
 * Compares the measured bundle sizes with the budget file, or writes the file with --write, and returns the exit code.
 * @param {string[]} args
 */
export function main(args) {
  const root = resolve(flagValue(args, '--root') ?? repoRoot);
  const budgetPath = resolve(
    flagValue(args, '--budget') ?? join(root, 'tools/test/bundle-budget.json')
  );
  const lockPath = resolve(flagValue(args, '--lock') ?? join(root, 'tools/test/export-lock.json'));
  const committed = existsSync(budgetPath) ? JSON.parse(readFileSync(budgetPath, 'utf8')) : null;
  const live = measureBudget(
    root,
    JSON.parse(readFileSync(lockPath, 'utf8')),
    (committed?.bundles ?? (flagValue(args, '--root') ? [] : DEFAULT_BUNDLES)).map(
      ({ label, import: line, platform }) => ({
        label,
        import: line,
        platform,
      })
    )
  );

  if (args.includes('--write')) {
    const budget = {
      note: 'Per-entry byte ceilings of bun run build output, before build:prod: each exports[].import file plus the files it statically imports. A growth past a ceiling updates this file in the same PR; ordinary size wiggle changes no line (see ceilingFor).',
      files: Object.fromEntries(
        Object.entries(live.files).map(([file, bytes]) => [file, ceilingFor(bytes)])
      ),
      entries: live.entries,
      bundles: live.bundles.map(({ label, import: line, platform, bytes }) => ({
        label,
        import: line,
        platform,
        maxBytes: ceilingFor(bytes),
      })),
    };
    writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
    console.log(`Wrote ${budgetPath}`);
    return 0;
  }

  if (!existsSync(budgetPath)) {
    console.error(`Missing ${budgetPath}. Run with --write after bun run build.`);
    return 1;
  }
  const failures = compareBudget(live, committed);
  if (failures.length > 0) {
    console.error('FAIL: bundle budget differs from tools/test/bundle-budget.json:');
    for (const line of failures) console.error(`  ${line}`);
    console.error('If deliberate, refresh with: node tools/test/check-bundle-budget.mjs --write');
    return 1;
  }
  console.log(
    `OK: ${Object.keys(live.files).length} files, ${Object.keys(live.entries).length} tree-shake entries and ${live.bundles.length} bundles match the budget.`
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
