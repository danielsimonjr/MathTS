/**
 * Decision gate for "should the special-function array overloads (bessel/airy/…)
 * dispatch to the Rust WASM kernels instead of falling back to JS?".
 *
 * Compares the Rust kernels (raw pointer ABI, realistic copy-in+out) against the
 * package's own JS path (besselJ0JS etc., which loop the series/Hankel scalars).
 * Run: npx tsx tools/benchmark/wasm/special-array.bench.mts
 *
 * RESULT (2026-06-25): WASM does NOT win — bessel ~0.9–1.1× (break-even), airy
 * ~0.4–0.5× (regresses). The JS scalars are already efficient + JIT'd and do the
 * same flops, so the JS↔wasm copy is pure overhead. Conclusion: NOT wired (unlike
 * the elementwise transcendentals, whose JS `Math.*` was the bottleneck). See
 * docs/roadmap/WASM_PAIRING_GAP_PLAN.md.
 */
import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  besselJ0JS,
  besselY0JS,
  airyAiJS,
  airyBiJS,
} from '../../../functions/src/wasm/special/wasm-bridge.js';

const here = dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(path.join(here, '../../../functions/dist/wasm/mathts.wasm'));
const { instance } = await WebAssembly.instantiate(buf, {});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ex = instance.exports as any;
const mem = ex.memory as WebAssembly.Memory;

const sizes = [1000, 10_000, 100_000];
const maxN = 100_000;
mem.grow(Math.ceil((2 * maxN * 8 + 65536) / 65536));
const inBase = mem.buffer.byteLength - 2 * maxN * 8 - 8;
const outBase = inBase + maxN * 8;

const bench = (fn: () => unknown, it: number): number => {
  const t = performance.now();
  for (let i = 0; i < it; i++) fn();
  return (performance.now() - t) / it;
};

const cases: [string, string, (xs: Float64Array) => Float64Array][] = [
  ['bessel_j0_f64', 'besselJ0', besselJ0JS],
  ['bessel_y0_f64', 'besselY0', besselY0JS],
  ['airy_ai_f64', 'airyAi', airyAiJS],
  ['airy_bi_f64', 'airyBi', airyBiJS],
];

console.log('Special-fn arrays: Rust WASM (incl. copy in+out) vs package JS');
console.log('size      kernel        wasm+copy   js        speedup  maxrel');
for (const n of sizes) {
  const src = new Float64Array(n);
  for (let i = 0; i < n; i++) src[i] = 0.5 + (i % 97) * 0.1;
  const it = n >= 100_000 ? 100 : 2000;
  for (const [k, name, jsfn] of cases) {
    const wasmCall = (): Float64Array => {
      new Float64Array(mem.buffer, inBase, n).set(src);
      ex[k](inBase, n, outBase);
      const r = new Float64Array(n);
      r.set(new Float64Array(mem.buffer, outBase, n));
      return r;
    };
    const w = wasmCall();
    const j = jsfn(src);
    let maxrel = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(w[i] - j[i]) / (Math.abs(j[i]) > 1e-12 ? Math.abs(j[i]) : 1);
      maxrel = Math.max(maxrel, d);
    }
    const wb = bench(wasmCall, it);
    const jb = bench(() => jsfn(src), it);
    console.log(
      `${String(n).padEnd(9)} ${name.padEnd(13)} ${wb.toFixed(4).padStart(9)} ${jb.toFixed(4).padStart(9)} ${(jb / wb).toFixed(2).padStart(7)}x ${maxrel.toExponential(1)}`
    );
  }
}
console.log('\nDecision: NOT wired — wasm is break-even (bessel) to ~2x slower (airy).');
