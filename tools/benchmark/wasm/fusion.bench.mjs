/**
 * Tier-3 proof: op-fusion amortizes the JS<->wasm copy across a chain of unary
 * ops. Compares, for a K-op chain over a Float64Array:
 *   - fused:      1 copy-in + K kernels (ping-pong in wasm) + 1 copy-out
 *   - sequential: K x (copy-in + kernel + copy-out)   [what per-op dispatch does]
 *   - js:         K sequential Math.* scalar passes
 * Run: npm run bench:fusion
 */
import { readFileSync } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const { instance } = await WebAssembly.instantiate(
  readFileSync(path.join(here, '../../../functions/dist/wasm/mathts.wasm')),
  {}
);
const ex = instance.exports;
const mem = ex.memory;

// chain: tanh(log1p(exp(sin(x)))) — all wins, all defined for x in a safe range
const CHAIN = ['sin', 'exp', 'log1p', 'tanh'];
const JS = { sin: Math.sin, exp: Math.exp, log1p: Math.log1p, tanh: Math.tanh };
const sizes = [1000, 10_000, 100_000];
const maxN = 100_000;
const ob = mem.buffer.byteLength;
mem.grow(Math.ceil((2 * maxN * 8 + 65536) / 65536));
const bufA = ob;
const bufB = ob + maxN * 8;
const bench = (f, it) => {
  const t = performance.now();
  for (let i = 0; i < it; i++) f();
  return (performance.now() - t) / it;
};

console.log(`Op-fusion: chain [${CHAIN.join(' -> ')}] — per-call ms, lower=better`);
console.log('size      fused    sequential   js       fused/seq  fused/js  maxrel');
for (const n of sizes) {
  const src = new Float64Array(n);
  for (let i = 0; i < n; i++) src[i] = (i % 100) * 0.01; // [0,1)

  const fused = () => {
    new Float64Array(mem.buffer, bufA, n).set(src);
    let cur = bufA, other = bufB;
    for (const op of CHAIN) {
      ex[`simd_${op}_array`](cur, other, n);
      [cur, other] = [other, cur];
    }
    const r = new Float64Array(n);
    r.set(new Float64Array(mem.buffer, cur, n));
    return r;
  };
  const sequential = () => {
    let data = src;
    for (const op of CHAIN) {
      new Float64Array(mem.buffer, bufA, n).set(data); // copy-in per op
      ex[`simd_${op}_array`](bufA, bufB, n);
      const r = new Float64Array(n);
      r.set(new Float64Array(mem.buffer, bufB, n)); // copy-out per op
      data = r;
    }
    return data;
  };
  const js = () => {
    const r = Float64Array.from(src);
    for (const op of CHAIN) for (let i = 0; i < n; i++) r[i] = JS[op](r[i]);
    return r;
  };

  const f = fused(), j = js();
  let mr = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(f[i] - j[i]) / (Math.abs(j[i]) > 1e-12 ? Math.abs(j[i]) : 1);
    mr = Math.max(mr, d);
  }
  const it = n >= 100_000 ? 100 : 2000;
  const fb = bench(fused, it), sb = bench(sequential, it), jb = bench(js, it);
  console.log(
    `${String(n).padEnd(9)} ${fb.toFixed(4).padStart(7)} ${sb.toFixed(4).padStart(10)} ${jb.toFixed(4).padStart(8)} ${(sb / fb).toFixed(2).padStart(9)}x ${(jb / fb).toFixed(2).padStart(8)}x ${mr.toExponential(1)}`
  );
}
console.log(`\n${CHAIN.length}-op chain: fused pays 1 copy-in + 1 copy-out; sequential pays ${CHAIN.length}x both.`);
