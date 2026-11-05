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
 *   bun --tsconfig-override=/abs/path/to/tsconfig.base.json tools/benchmark/scalar-search/run.mjs
 *
 * Node cannot import the bench's TypeScript imports directly, so the bench is
 * bundled with esbuild into `functions/.bench/` (gitignored) and executed as
 * its own Node process, like the WASM runner. Workspace packages stay external
 * and resolve to each package's built `dist/`; the bench imports
 * `evaluateScalarPopulation` from `functions/dist/` (internal module, not the
 * barrel). Bun runs `bench.ts` in place with the same dist resolution.
 *
 * `--engine node|bun` re-execs this file on the requested engine (real node
 * via PERF_NODE or PATH; bun with the tsconfig override). Default engine is
 * `node`. `--reps <n>` raises the minimum timed reps per case.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScalarSearchBundle } from './bundle.mjs';
import { nodeBinary, parseArgs } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const tsconfigBase = join(repoRoot, 'tsconfig.base.json');
const underBun = Boolean(process.versions.bun);

const args = parseArgs(process.argv.slice(2));
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
    [`--tsconfig-override=${tsconfigBase}`, join(here, 'run.mjs'), ...process.argv.slice(2)],
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
  await buildScalarSearchBundle(repoRoot, outfile);
  const run = spawnSync(nodeBinary(), [outfile], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
}
