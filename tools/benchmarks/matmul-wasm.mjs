// Does matrix's WASM matmul (SIMD f64x2 ikj kernel, via WASMBackend) beat a cache-friendly
// JS ikj loop for large matrices? IMPORTANT: the WASM backend loads async — you MUST await
// wasmBackend.initialize() or it silently falls back to JS (and you'd measure the JS path).
import { DenseMatrix, wasmBackend } from '../../matrix/dist/index.js';

await wasmBackend.initialize();
console.log('wasm loaded:', wasmBackend.isAvailable?.() ?? '(no isAvailable)', '\n');

function ijk(a, b, m, k, n) {
  const o = new Float64Array(m * n);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let q = 0; q < k; q++) s += a[i * k + q] * b[q * n + j];
      o[i * n + j] = s;
    }
  return o;
}
function ikj(a, b, m, k, n) {
  const o = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    const ri = i * n,
      ai = i * k;
    for (let q = 0; q < k; q++) {
      const aiq = a[ai + q],
        bq = q * n;
      for (let j = 0; j < n; j++) o[ri + j] += aiq * b[bq + j];
    }
  }
  return o;
}
function t(f, it) {
  for (let w = 0; w < 3; w++) f();
  const s = process.hrtime.bigint();
  for (let i = 0; i < it; i++) f();
  return Number(process.hrtime.bigint() - s) / 1e6 / it;
}

// correctness: matrix WASM vs JS
{
  const N = 48;
  const a = Float64Array.from({ length: N * N }, () => Math.random()),
    b = Float64Array.from({ length: N * N }, () => Math.random());
  const j = ijk(a, b, N, N, N);
  const w = wasmBackend
    .multiply(new DenseMatrix(N, N, a), new DenseMatrix(N, N, b))
    .toFloat64Array();
  let e = 0;
  for (let i = 0; i < N * N; i++) e = Math.max(e, Math.abs(j[i] - w[i]));
  console.log('matrix WASM matmul correctness max err:', e.toExponential(2), '\n');
}

console.log(
  'size'.padStart(7),
  'JS-ijk'.padStart(10),
  'JS-ikj'.padStart(10),
  'matrix-WASM'.padStart(12),
  'WASM vs ikj'.padStart(12)
);
for (const N of [64, 128, 256, 512]) {
  const a = Float64Array.from({ length: N * N }, () => Math.random()),
    b = Float64Array.from({ length: N * N }, () => Math.random());
  const da = new DenseMatrix(N, N, a),
    db = new DenseMatrix(N, N, b);
  const it = Math.max(3, Math.round(4e7 / (N * N * N)));
  const tijk = t(() => ijk(a, b, N, N, N), it);
  const tikj = t(() => ikj(a, b, N, N, N), it);
  const tw = t(() => wasmBackend.multiply(da, db), it);
  const r = tikj / tw;
  console.log(
    (N + 'x' + N).padStart(7),
    tijk.toFixed(2).padStart(10),
    tikj.toFixed(2).padStart(10),
    tw.toFixed(2).padStart(12),
    ((r >= 1 ? r.toFixed(2) : '(' + r.toFixed(2)) + 'x)').padStart(12),
    r >= 1.15 ? ' WASM wins' : r <= 0.87 ? ' JS wins' : ' ~tie'
  );
}
