// Decomposition audit: JS vs WASM for eig/svd (the only decompositions with a wired WASM
// variant; tensor dogfoods eigWasm/svdWasm). eigWasm/svdWasm are ASYNC (they await
// wasmLoader.load()). NOTE: as of 2026-07-01 the WASM decomposition path is retired
// (WASM_EIG_ENABLED / WASM_SVD_ENABLED = false), so eigWasm/svdWasm now delegate to JS —
// re-run this after flipping those flags (or after a SIMD-optimized kernel) to re-measure.
import { eig, eigWasm, svd, svdWasm } from '../../matrix/dist/index.js';

const re = (v) => (typeof v === 'number' ? v : (v?.re ?? NaN));
function symMatrix(n) {
  const a = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.random() - 0.5));
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) { const v = (a[i][j] + a[j][i]) / 2; a[i][j] = v; a[j][i] = v; }
  return a;
}
function tSync(f, it) { for (let w = 0; w < 2; w++) f(); const s = process.hrtime.bigint(); for (let i = 0; i < it; i++) f(); return Number(process.hrtime.bigint() - s) / 1e6 / it; }
async function tAsync(f, it) { for (let w = 0; w < 2; w++) await f(); const s = process.hrtime.bigint(); for (let i = 0; i < it; i++) await f(); return Number(process.hrtime.bigint() - s) / 1e6 / it; }

{
  const A = [[2, 1, 0], [1, 2, 1], [0, 1, 2]]; // eigenvalues ~ {0.586, 2, 3.414}
  const j = [...eig(A, { computeVectors: false }).values].map(re).sort((x, y) => x - y);
  const w = [...(await eigWasm(A, { computeVectors: false })).values].map(re).sort((x, y) => x - y);
  let e = 0; for (let i = 0; i < 3; i++) e = Math.max(e, Math.abs(j[i] - w[i]));
  console.log('eigWasm correctness vs JS:', e < 1e-6 ? 'ok' : 'ERR ' + e.toExponential(1), '\n');
}

console.log('size'.padStart(7), 'eig-JS'.padStart(9), 'eig-WASM'.padStart(9), 'eig x'.padStart(7), 'svd-JS'.padStart(9), 'svd-WASM'.padStart(9), 'svd x'.padStart(7));
for (const N of [16, 32, 64, 128]) {
  const A = symMatrix(N);
  const it = Math.max(3, Math.round(2e6 / (N * N * N)));
  const ej = tSync(() => eig(A, { computeVectors: false }), it);
  const ew = await tAsync(() => eigWasm(A, { computeVectors: false }), it);
  const sj = tSync(() => svd(A, { computeVectors: false }), it);
  const sw = await tAsync(() => svdWasm(A, { computeVectors: false }), it);
  console.log((N + 'x' + N).padStart(7), ej.toFixed(3).padStart(9), ew.toFixed(3).padStart(9), (ej / ew).toFixed(2).padStart(6) + 'x', sj.toFixed(3).padStart(9), sw.toFixed(3).padStart(9), (sj / sw).toFixed(2).padStart(6) + 'x');
}
process.exit(0);
