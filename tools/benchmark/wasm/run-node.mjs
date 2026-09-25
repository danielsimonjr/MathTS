#!/usr/bin/env node
/**
 * Run the WASM-vs-JS benchmark suite on Node (V8).
 *
 * `bun run bench:wasm` runs the suite on Bun, whose engine is JavaScriptCore, and the
 * winner can flip between engines: on 2026-09-25, `sin`/`cos`/`tan` measured faster in
 * JS on Bun, while the elementwise bridge documents V8 wins. Node and Chromium users
 * run V8, so dispatch decisions need V8 numbers. Run it with `node` directly (a
 * `bun run` script would put it back on Bun): `node tools/benchmark/wasm/run-node.mjs`.
 *
 * Node cannot import the `.ts` benchmark sources directly, so each area is bundled
 * with esbuild and executed as its own process. The areas must be bundled one per file:
 * every bench module decides whether it is the entry point with
 * `isMainModule(import.meta.url)`, and in a single bundle all modules share one
 * `import.meta.url`, so every area would start at once and they would time each other.
 * The bundles go to `functions/.bench/` (gitignored) because the loader resolves the
 * packaged `dist/wasm/mathts-as.wasm` from the nearest package root.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const outDir = join(repoRoot, 'functions', '.bench');
const AREAS = ['elementwise', 'special', 'sort', 'matrix'];

mkdirSync(outDir, { recursive: true });
console.log(
  `WASM-vs-JS benchmarks on Node ${process.version} (V8), ${process.platform} ${process.arch}`
);
for (const area of AREAS) {
  const outfile = join(outDir, `${area}.mjs`);
  await build({
    entryPoints: [join(here, `${area}.bench.ts`)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'warning',
  });
  const run = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`run-node: ${area} benchmark failed (exit ${run.status})`);
    process.exit(run.status ?? 1);
  }
}
