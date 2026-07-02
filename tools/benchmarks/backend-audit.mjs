// Backend audit: JS vs WASM(SIMD) vs Parallel, per matrix op. Drives the "which backend for
// which op" verdict (2026-07-01). Run: `node tools/benchmarks/backend-audit.mjs` from repo
// root (needs `npm run build` for matrix's dist + wasm binary). WASM loads async — the
// script awaits wasmBackend.initialize() or it would silently measure the JS fallback.
import { DenseMatrix, jsBackend, wasmBackend, parallelBackend } from '../../matrix/dist/index.js';

await wasmBackend.initialize();

const rand = (n) => new DenseMatrix(n, n, Float64Array.from({ length: n * n }, () => Math.random()));
async function tAsync(f, it) { for (let w = 0; w < 3; w++) await f(); const s = process.hrtime.bigint(); for (let i = 0; i < it; i++) await f(); return Number(process.hrtime.bigint() - s) / 1e6 / it; }
function tSync(f, it) { for (let w = 0; w < 3; w++) f(); const s = process.hrtime.bigint(); for (let i = 0; i < it; i++) f(); return Number(process.hrtime.bigint() - s) / 1e6 / it; }

const OPS = [
  { name: 'multiply', binary: true },
  { name: 'multiplyElementwise', binary: true },
  { name: 'add', binary: true },
  { name: 'transpose', binary: false },
];

for (const N of [128, 256, 512]) {
  const a = rand(N), b = rand(N);
  const itMul = Math.max(3, Math.round(1.5e8 / (N * N * N)));
  const itEl = Math.max(5, Math.round(1e7 / (N * N)));
  console.log(`\n=== ${N}x${N} ===`);
  console.log('op'.padEnd(20), 'JS ms'.padStart(9), 'WASM ms'.padStart(9), 'Par ms'.padStart(9), 'best'.padStart(8));
  for (const op of OPS) {
    const it = op.name === 'multiply' ? itMul : itEl;
    const jsCall = op.binary ? () => jsBackend[op.name](a, b) : () => jsBackend[op.name](a);
    const wCall = op.binary ? () => wasmBackend[op.name](a, b) : () => wasmBackend[op.name](a);
    const pCall = op.binary ? () => parallelBackend[op.name](a, b) : () => parallelBackend[op.name](a);
    let js, w, p;
    try { js = tSync(jsCall, it); } catch { js = NaN; }
    try { w = tSync(wCall, it); } catch { w = NaN; }
    try { p = await tAsync(pCall, Math.min(it, 15)); } catch { p = NaN; }
    const cands = [['JS', js], ['WASM', w], ['Par', p]].filter(([, v]) => !isNaN(v));
    const best = cands.reduce((m, c) => (c[1] < m[1] ? c : m))[0];
    console.log(op.name.padEnd(20), (isNaN(js) ? '-' : js.toFixed(3)).padStart(9), (isNaN(w) ? '-' : w.toFixed(3)).padStart(9), (isNaN(p) ? '-' : p.toFixed(3)).padStart(9), best.padStart(8));
  }
}
process.exit(0);
