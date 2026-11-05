#!/usr/bin/env node
/**
 * Dispatcher for the scalar-search benchmark harness (plan SR-11).
 *
 * The bench itself is `bench.ts`; this file picks the engine and keeps one
 * process per code tree (AGENTS.md benchmarking rules):
 *
 *   # Node (V8). Under `bun run`, `node` is Bun, so call a real node directly;
 *   # PERF_NODE=/path/to/node overrides the lookup.
 *   node tools/benchmark/scalar-search/run.mjs
 *
 *   # Bun (JavaScriptCore), with the tsconfig override that stops Bun mapping
 *   # the workspace packages to their src trees:
 *   bun --tsconfig-override=tsconfig.base.json tools/benchmark/scalar-search/run.mjs
 *
 * Node cannot import the bench's TypeScript (and its `functions/src`) imports
 * directly, so the bench is bundled with esbuild into `functions/.bench/`
 * (gitignored) and executed as its own Node process, like the WASM runner.
 * Bun runs `bench.ts` in place.
 *
 * `--engine node|bun` re-execs this file on the requested engine (real node
 * via PERF_NODE or PATH; bun with the tsconfig override). `--reps <n>` raises
 * the minimum timed reps per case.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { nodeBinary, parseArgs } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const underBun = Boolean(process.versions.bun);

const args = parseArgs(process.argv.slice(2), { node: !underBun, bun: underBun });
if (args.help) {
  console.log('usage: node tools/benchmark/scalar-search/run.mjs [--reps <n>] [--engine node|bun]');
  process.exit(0);
}

if (args.engine === 'node' && underBun) {
  const run = spawnSync(nodeBinary(), [import.meta.filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  process.exit(run.status ?? 1);
}
if (args.engine === 'bun' && !underBun) {
  const run = spawnSync(
    'bun',
    ['--tsconfig-override=tsconfig.base.json', join(here, 'run.mjs'), ...process.argv.slice(2)],
    { stdio: 'inherit' }
  );
  process.exit(run.status ?? 1);
}

process.env.SCALAR_BENCH_REPS = String(args.reps);
process.env.SCALAR_BENCH_WORKER = join(repoRoot, 'functions', 'dist', 'scalar-batch.worker.js');

if (underBun) {
  await import('./bench.ts');
} else {
  const outfile = join(repoRoot, 'functions', '.bench', 'scalar-search.mjs');
  mkdirSync(dirname(outfile), { recursive: true });
  await build({
    entryPoints: [join(here, 'bench.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    // Keep the workspace packages external so the bundle imports exactly the
    // built dist code a consumer runs, and does not duplicate module state.
    packages: 'external',
    // core/src (reached through the src imports) declares `__PKG_VERSION__`,
    // which core's own tsdown config supplies from its package.json.
    define: {
      __PKG_VERSION__: JSON.stringify(
        JSON.parse(readFileSync(join(repoRoot, 'core', 'package.json'), 'utf8')).version
      ),
    },
    outfile,
    logLevel: 'warning',
  });
  const run = spawnSync(nodeBinary(), [outfile], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
}
