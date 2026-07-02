// Item 215: where's the SIMD-WASM matmul crossover vs JS at SMALL sizes? Current
// wasmThreshold = 1000 elems (~32²). Force WASM (minElements:0) and compare to JS.
import { DenseMatrix, WASMBackend, jsBackend } from '../../matrix/dist/index.js';

const wasm = new WASMBackend({ minElements: 0 });
await wasm.initialize();
// Confirm WASM actually loaded (else we'd be comparing JS to JS).
console.log('WASM backend type:', wasm.getBackendType?.() ?? '(n/a)');

function randDense(n) {
  const d = new Array(n * n);
  for (let i = 0; i < n * n; i++) d[i] = Math.random();
  return DenseMatrix.fromFlat(n, n, d);
}
function t(fn, it) {
  for (let w = 0; w < 5; w++) fn();
  const s = process.hrtime.bigint();
  for (let i = 0; i < it; i++) fn();
  return Number(process.hrtime.bigint() - s) / 1e6 / it; // ms/call
}

console.log('\n n   elems   JS µs   WASM µs   JS/WASM   verdict');
for (const n of [8, 12, 16, 24, 32, 48, 64, 96, 128]) {
  const a = randDense(n), b = randDense(n);
  const it = Math.max(200, Math.round(4e7 / (n * n * n)));
  const js = t(() => jsBackend.multiply(a, b), it);
  const ws = t(() => wasm.multiply(a, b), it);
  const ratio = js / ws; // >1 → WASM faster
  const verdict = ratio >= 1.1 ? 'WASM wins' : ratio <= 0.91 ? 'JS wins' : '~tie';
  console.log(
    `${String(n).padStart(3)} ${String(n * n).padStart(6)} ${(js * 1000).toFixed(1).padStart(8)} ${(ws * 1000).toFixed(1).padStart(8)}   ${ratio.toFixed(2).padStart(5)}x   ${verdict}${n * n === 1024 ? '   <- ~current threshold (1000)' : ''}`
  );
}
process.exit(0);
