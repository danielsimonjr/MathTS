// Dogfooding spike: should Tensor.matMul (a naive JS triple loop) delegate to matrix's
// backend-accelerated multiply so it inherits large-input WASM? Measure the matrix path
// (backendManager.multiply, which selects WASMBackend above 1000 elements) vs the tight
// JS loop it would replace — before wiring it.
import { readFileSync } from 'node:fs';
const { DenseMatrix, backendManager } = await import('../../matrix/dist/index.js');

function jsMatmul(a, b, m, k, n) {
  const out = new Float64Array(m * n);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let q = 0; q < k; q++) s += a[i * k + q] * b[q * n + j];
      out[i * n + j] = s;
    }
  return out;
}
function time(fn, it) {
  for (let w = 0; w < 2; w++) fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < it; i++) fn();
  return Number(process.hrtime.bigint() - t0) / 1e6 / it;
}

console.log('backend selected for 65536 elems:', backendManager.selectBackend(65536));
console.log(
  'size'.padStart(9),
  'JS ms'.padStart(11),
  'matrix ms'.padStart(11),
  'speedup'.padStart(9)
);
for (const N of [64, 128, 256, 512]) {
  const a = Float64Array.from({ length: N * N }, () => Math.random());
  const b = Float64Array.from({ length: N * N }, () => Math.random());
  const da = new DenseMatrix(N, N, a),
    db = new DenseMatrix(N, N, b);
  const it = Math.max(3, Math.round(4e7 / (N * N * N)));
  const js = time(() => jsMatmul(a, b, N, N, N), it);
  const mx = time(() => backendManager.multiply(da, db), it);
  const r = js / mx;
  console.log(
    `${N}x${N}`.padStart(9),
    js.toFixed(3).padStart(11),
    mx.toFixed(3).padStart(11),
    ((r >= 1 ? r.toFixed(2) : '(' + r.toFixed(2)) + 'x)').padStart(9),
    r >= 1.15 ? ' matrix wins' : r <= 0.87 ? ' JS wins' : ' ~tie'
  );
}
