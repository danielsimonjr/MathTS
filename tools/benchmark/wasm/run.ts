/**
 * WASM (AssemblyScript) vs JS benchmark suite — full runner.
 *
 * Runs every area bench in sequence (elementwise, special functions, sort,
 * matrix heavy ops + FFT) against the AssemblyScript binary that the `functions`
 * and `matrix` packages load. Prints one table per operation with:
 *
 *   n  ·  JS (ms)  ·  AS (ms)  ·  AS/JS ratio  ·  verdict  ·  correctness maxdiff
 *
 * All numbers are measured at run time (median of several reps, full JS↔wasm
 * round-trip). Nothing is hard-coded. Re-run on target hardware for
 * authoritative figures.
 *
 * Run: `npm run bench:wasm`
 * Per-area: `npm run bench:elementwise | bench:special | bench:sort | bench:matrix`
 */

import { main as elementwiseMain } from './elementwise.bench.js';
import { main as specialMain } from './special.bench.js';
import { main as sortMain } from './sort.bench.js';
import { main as matrixMain } from './matrix.bench.js';

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  console.log('MathTS — AssemblyScript-vs-JS WASM benchmark suite');
  console.log(`Run started: ${startedAt}`);
  console.log(`Node: ${process.version}  platform: ${process.platform} ${process.arch}`);

  await elementwiseMain();
  await specialMain();
  await sortMain();
  await matrixMain();

  console.log('');
  console.log('='.repeat(74));
  console.log('Suite complete. AS/JS < 1.00x = AssemblyScript wins; maxdiff = AS-vs-JS accuracy.');
  console.log('='.repeat(74));
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
