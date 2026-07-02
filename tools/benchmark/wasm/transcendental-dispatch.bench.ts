/**
 * The DEFINITIVE element-wise transcendental comparison: the WASM dispatch
 * (`elementwiseUnaryDispatch`, the `array_<op>_ptr` kernel) vs the ACTUAL production
 * fallback it competes with — `computePool.<op>` (ComputePool, threshold `'never'` for these
 * ops so it runs synchronously in JS). Prior benchmarks compared WASM to a bare/indirect
 * `Math.*` loop, which is NOT what production falls back to. This settles whether the
 * transcendental WASM path earns its keep. Run: `npx tsx tools/benchmark/wasm/transcendental-dispatch.bench.ts`
 */
import { initWasm } from '../../../functions/src/wasm/WasmLoader.js';
import {
  elementwiseUnaryDispatch,
  type WasmElementwiseOp,
} from '../../../functions/src/wasm/elementwise/wasm-bridge.js';
import { computePool } from '../../../parallel/src/index.js';

const SIZES = [1024, 4096, 16384, 65536, 262144];
const OPS: WasmElementwiseOp[] = ['exp', 'sin', 'log'];

function positive(n: number): Float64Array {
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = Math.random() + 0.1;
  return xs;
}

async function main(): Promise<void> {
  await initWasm();

  console.log(
    'WASM (elementwiseUnaryDispatch) vs computePool.<op> — the real production fallback.'
  );
  console.log(
    'pool/wasm > 1 => WASM faster (should keep); < 1 => computePool faster (retire candidate).\n'
  );
  console.log('op    size      WASM ms   pool ms   pool/wasm   verdict');

  for (const op of OPS) {
    for (const n of SIZES) {
      const xs = positive(n);
      // sanity: dispatch must actually take the WASM path (non-null) at this size
      const probe = elementwiseUnaryDispatch(op, xs);
      const onWasm = probe !== null;

      // WASM timing (sync)
      const itW = Math.max(50, Math.round(2e7 / n));
      for (let w = 0; w < 5; w++) elementwiseUnaryDispatch(op, xs);
      let s = process.hrtime.bigint();
      for (let i = 0; i < itW; i++) elementwiseUnaryDispatch(op, xs);
      const wasmMs = Number(process.hrtime.bigint() - s) / 1e6 / itW;

      // computePool timing (async; threshold 'never' => sync JS under the hood)
      const itP = Math.max(20, Math.round(5e6 / n));
      for (let w = 0; w < 3; w++) await computePool[op](xs);
      s = process.hrtime.bigint();
      for (let i = 0; i < itP; i++) await computePool[op](xs);
      const poolMs = Number(process.hrtime.bigint() - s) / 1e6 / itP;

      const ratio = poolMs / wasmMs;
      const verdict = !onWasm
        ? 'JS(below thresh)'
        : ratio >= 1.1
          ? 'WASM wins'
          : ratio <= 0.91
            ? 'pool wins'
            : '~tie';
      console.log(
        `${op.padEnd(4)} ${String(n).padStart(7)} ${wasmMs.toFixed(4).padStart(9)} ${poolMs.toFixed(4).padStart(9)} ${ratio.toFixed(2).padStart(9)}x   ${verdict}`
      );
    }
  }
  await computePool.terminate?.();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
