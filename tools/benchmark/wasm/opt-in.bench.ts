/**
 * What `loadWasm()` does to the PUBLIC `functions` API — unloaded vs loaded.
 *
 * The other benches time a bridge's dispatch against its own JS fallback. This one times
 * the symbols a consumer imports (`sin`, `lgamma`, `welchPSD`, `polymul`, ...) on the same
 * input with the AssemblyScript tier off (the default for every consumer) and on (after
 * `loadWasm()`). The ratio on/off is what opting in costs or saves; < 1 means `loadWasm()`
 * makes that call faster.
 *
 * The module is loaded once; "off" makes `wasmLoader.getModule()` return `null`, which is
 * the only thing every bridge checks, so both tiers run in one warmed process. Off and on
 * reps are interleaved (ABBA) after a warm-up of both. A first version timed all "off" reps
 * before all "on" reps, and JIT warm-up alone then made identical JS paths differ by up to
 * 4.5x; the `control` case (below every threshold, so both tiers run the same JS) measures
 * whatever order bias is left and should stay near 1.00.
 *
 * A loaded row counts only if the WASM path really ran. Before timing it, one probe call
 * runs with `wasmLoader.getModule()` swapped for a copy whose kernels count calls; the row records
 * which kernel exports were called (AS runtime helpers such as `__new` do not count).
 * Below a bridge's size threshold nothing engages, and the row says so. A size at or above
 * the threshold that does not engage fails the run: a silent JS fallback must never be
 * timed as the WASM tier. Each loaded result is also compared with the unloaded one.
 *
 * Run on V8, twice (AGENTS.md benchmarking rules 7, 8 and 10):
 *   node tools/benchmark/wasm/run-node.mjs opt-in
 */
import * as F from '../../../functions/src/index.js';
import { loadWasm, wasmLoader } from '../../../functions/src/wasm/WasmLoader.js';
import { overrideWasmPolicy } from '../../../functions/src/wasm/policy.js';
import { WASM_ELEMENTWISE_THRESHOLD } from '../../../functions/src/wasm/elementwise/wasm-bridge.js';
import { WASM_SPECIAL_THRESHOLD } from '../../../functions/src/wasm/special/wasm-bridge.js';
import { WASM_SORT_THRESHOLD } from '../../../functions/src/wasm/sort/wasm-bridge.js';
import { WASM_SIGNAL_THRESHOLD } from '../../../functions/src/wasm/signal/wasm-bridge.js';
import {
  WASM_POLY_THRESHOLD,
  WASM_POLY_FIT_THRESHOLD,
} from '../../../functions/src/wasm/poly/wasm-bridge.js';
import {
  WASM_TRIDIAG_THRESHOLD,
  WASM_INTERP_THRESHOLD,
} from '../../../functions/src/wasm/interpolation/wasm-bridge.js';
import { WASM_BITWISE_THRESHOLD } from '../../../functions/src/wasm/bitwise/wasm-bridge.js';
import { computePool } from '../../../parallel/src/index.js';
import { defaultIterations, isMainModule, median } from './harness.js';

type Fn = (...args: unknown[]) => unknown;
const api = F as unknown as Record<string, Fn>;

/** One public call, measured unloaded vs loaded. */
interface OptInCase {
  name: string;
  /** Smallest size at which the bridge dispatches to WASM. */
  threshold: number;
  sizes: number[];
  prepare: (n: number) => unknown[];
  call: (args: unknown[]) => unknown;
  /** Output reduced to numbers, so the two tiers can be compared. */
  numbers: (out: unknown) => ArrayLike<number>;
}

// Deterministic inputs (mulberry32), so both tiers and both runs see the same data.
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function uniform(n: number, lo: number, hi: number, seed = 1): Float64Array {
  const r = rng(seed);
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = lo + (hi - lo) * r();
  return xs;
}
const plain = (xs: Float64Array): number[] => Array.from(xs);
const f64 = (out: unknown): ArrayLike<number> => out as Float64Array;
const one = (out: unknown): ArrayLike<number> => [out as number];

const ELEMENT_SIZES = [1024, 16384, 131072, 1_048_576];

const ELEMENTWISE: Array<[string, number, number]> = [
  ['sin', 0.1, 0.9],
  ['cos', 0.1, 0.9],
  ['tan', 0.1, 0.9],
  ['atan', 0.1, 0.9],
  ['atanh', 0.1, 0.9],
  ['sec', 0.1, 0.9],
  ['csc', 0.1, 0.9],
  ['cot', 0.1, 0.9],
  ['abs', -1, 1],
  ['exp', 0.1, 0.9],
  ['log', 0.1, 0.9],
  ['log10', 0.1, 0.9],
  ['log2', 0.1, 0.9],
  ['log1p', 0.1, 0.9],
  ['expm1', 0.1, 0.9],
  ['sinh', 0.1, 0.9],
  ['tanh', 0.1, 0.9],
  ['erfc', 0.1, 3],
];

const cases: OptInCase[] = [
  {
    // Below every threshold, so both tiers run the same JS: its ratio is the harness's
    // own order bias and should stay near 1.00.
    name: 'control',
    threshold: Infinity,
    sizes: [512],
    prepare: (n) => [uniform(n, 0.1, 0.9)],
    call: (a) => api.sin(a[0]),
    numbers: f64,
  },
  ...ELEMENTWISE.map(([op, lo, hi]): OptInCase => ({
    name: op,
    threshold: WASM_ELEMENTWISE_THRESHOLD,
    sizes: ELEMENT_SIZES,
    prepare: (n) => [uniform(n, lo, hi)],
    call: (a) => api[op](a[0]),
    numbers: f64,
  })),
  {
    name: 'fuseUnaryChain(sin,exp)',
    threshold: WASM_ELEMENTWISE_THRESHOLD,
    sizes: ELEMENT_SIZES,
    prepare: (n) => [uniform(n, 0.1, 0.9)],
    call: (a) => api.fuseUnaryChain(['sin', 'exp'], a[0]),
    numbers: f64,
  },
  {
    // A chain of ops that each lose alone: does keeping the data resident still win?
    name: 'fuseUnaryChain(tanh,expm1)',
    threshold: WASM_ELEMENTWISE_THRESHOLD,
    sizes: ELEMENT_SIZES,
    prepare: (n) => [uniform(n, 0.1, 0.9)],
    call: (a) => api.fuseUnaryChain(['tanh', 'expm1'], a[0]),
    numbers: f64,
  },
  ...(
    [
      ['lgamma', 0.5, 20],
      ['besselJ0', 0.5, 30],
      ['besselJ1', 0.5, 30],
      ['besselY0', 0.5, 30],
      ['besselY1', 0.5, 30],
      ['airyAi', -5, 5],
      ['airyBi', -5, 2],
      ['ellipticK', 0, 0.95],
      ['ellipticE', 0, 0.95],
    ] as Array<[string, number, number]>
  ).map(([fn, lo, hi]): OptInCase => ({
    name: fn,
    threshold: WASM_SPECIAL_THRESHOLD,
    sizes: ELEMENT_SIZES,
    prepare: (n) => [uniform(n, lo, hi)],
    call: (a) => api[fn](a[0]),
    numbers: f64,
  })),
  {
    name: 'besselJ(2, x)',
    threshold: WASM_SPECIAL_THRESHOLD,
    sizes: ELEMENT_SIZES,
    prepare: (n) => [2, uniform(n, 0.5, 30)],
    call: (a) => api.besselJ(a[0], a[1]),
    numbers: f64,
  },
  {
    name: 'ellipticF(phi, m)',
    threshold: WASM_SPECIAL_THRESHOLD,
    sizes: ELEMENT_SIZES,
    prepare: (n) => [uniform(n, 0, 1.5, 2), uniform(n, 0, 0.9, 3)],
    call: (a) => api.ellipticF(a[0], a[1]),
    numbers: f64,
  },
  {
    name: 'carlsonRF(x, y, z)',
    threshold: WASM_SPECIAL_THRESHOLD,
    sizes: ELEMENT_SIZES,
    prepare: (n) => [uniform(n, 0.1, 2, 4), uniform(n, 0.1, 2, 5), uniform(n, 0.1, 2, 6)],
    call: (a) => api.carlsonRF(a[0], a[1], a[2]),
    numbers: f64,
  },
  {
    name: 'parallelStatMedian',
    threshold: WASM_SORT_THRESHOLD,
    sizes: [16384, 131072, 1_048_576],
    prepare: (n) => [uniform(n, -1e6, 1e6)],
    call: (a) => api.parallelStatMedian(a[0]),
    numbers: one,
  },
  {
    name: 'parallelStatQuantile(0.9)',
    threshold: WASM_SORT_THRESHOLD,
    sizes: [16384, 131072, 1_048_576],
    prepare: (n) => [uniform(n, -1e6, 1e6, 27), 0.9],
    call: (a) => api.parallelStatQuantile(a[0], a[1]),
    numbers: one,
  },
  {
    name: 'kolmogorovSmirnovTest',
    threshold: WASM_SORT_THRESHOLD,
    sizes: [16384, 131072],
    prepare: (n) => [plain(uniform(n, 0, 1, 28))],
    call: (a) => api.kolmogorovSmirnovTest(a[0]),
    numbers: (out) => [(out as { pValue: number }).pValue],
  },
  {
    name: 'mannWhitneyTest',
    threshold: WASM_SORT_THRESHOLD,
    sizes: [16384, 131072],
    prepare: (n) => [plain(uniform(n, 0, 1, 7)), plain(uniform(n, 0.01, 1.01, 8))],
    call: (a) => api.mannWhitneyTest(a[0], a[1]),
    numbers: (out) => [(out as { pValue: number }).pValue],
  },
  {
    name: 'convexHull2D',
    threshold: WASM_SORT_THRESHOLD,
    sizes: [16384, 131072],
    prepare: (n) => {
      const xs = uniform(n, -1, 1, 9);
      const ys = uniform(n, -1, 1, 10);
      return [Array.from(xs, (x, i) => [x, ys[i]])];
    },
    call: (a) => api.convexHull2D(a[0]),
    numbers: (out) => (out as number[][]).flat(),
  },
  {
    name: 'welchPSD',
    threshold: WASM_SIGNAL_THRESHOLD,
    sizes: [4096, 65536, 1_048_576],
    prepare: (n) => [uniform(n, -1, 1, 11), { frameLength: 256 }],
    call: (a) => api.welchPSD(a[0], a[1]),
    numbers: (out) => (out as { psd: number[] }).psd,
  },
  {
    name: 'bartlettPSD',
    threshold: WASM_SIGNAL_THRESHOLD,
    sizes: [4096, 65536, 1_048_576],
    prepare: (n) => [uniform(n, -1, 1, 12), { frameLength: 256 }],
    call: (a) => api.bartlettPSD(a[0], a[1]),
    numbers: (out) => (out as { psd: number[] }).psd,
  },
  {
    name: 'goertzel',
    threshold: WASM_SIGNAL_THRESHOLD,
    sizes: [4096, 65536, 1_048_576],
    prepare: (n) => [uniform(n, -1, 1, 13), 50, 1000],
    call: (a) => api.goertzel(a[0], a[1], a[2]),
    numbers: one,
  },
  {
    name: 'chirpZTransform(m=64)',
    threshold: WASM_SIGNAL_THRESHOLD,
    sizes: [4096, 65536],
    prepare: (n) => [uniform(n, -1, 1, 14), 64],
    call: (a) => api.chirpZTransform(a[0], a[1]),
    numbers: (out) => (out as { re: Float64Array }).re,
  },
  {
    name: 'polymul',
    threshold: WASM_POLY_THRESHOLD,
    sizes: [256, 1024, 4096],
    prepare: (n) => [plain(uniform(n, -1, 1, 15)), plain(uniform(n, -1, 1, 16))],
    call: (a) => api.polymul(a[0], a[1]),
    numbers: (out) => out as number[],
  },
  {
    name: 'resultant',
    threshold: WASM_POLY_THRESHOLD,
    sizes: [256, 512],
    prepare: (n) => [plain(uniform(n, -1, 1, 17)), plain(uniform(n, -1, 1, 18))],
    call: (a) => api.resultant(a[0], a[1]),
    numbers: one,
  },
  {
    name: 'polynomialQuotient',
    threshold: WASM_POLY_THRESHOLD,
    sizes: [256, 1024, 4096],
    prepare: (n) => [plain(uniform(n, -1, 1, 23)), plain(uniform(n >> 1, 0.5, 1, 24))],
    call: (a) => api.polynomialQuotient(a[0], a[1]),
    numbers: (out) => out as number[],
  },
  {
    name: 'discriminant',
    threshold: WASM_POLY_THRESHOLD,
    sizes: [256, 512],
    prepare: (n) => [plain(uniform(n, -1, 1, 25))],
    call: (a) => api.discriminant(a[0]),
    numbers: one,
  },
  ...(['chebyshevFit', 'legendreFit'] as const).map((fn): OptInCase => ({
    name: `${fn}(deg 5)`,
    threshold: WASM_POLY_FIT_THRESHOLD,
    sizes: [1024, 16384, 131072],
    prepare: (n) => {
      const xs = uniform(n, -1, 1, 26);
      return [plain(xs), plain(xs.map((x) => 1 + 2 * x - 3 * x * x * x)), 5];
    },
    call: (a) => api[fn](a[0], a[1], a[2]),
    numbers: (out) => out as number[],
  })),
  {
    name: 'polyFit(deg 5)',
    threshold: WASM_POLY_FIT_THRESHOLD,
    sizes: [1024, 16384, 131072],
    prepare: (n) => {
      const xs = uniform(n, -1, 1, 19);
      return [plain(xs), plain(xs.map((x) => 1 + 2 * x - 3 * x * x * x)), 5];
    },
    call: (a) => api.polyFit(a[0], a[1], a[2]),
    numbers: (out) => out as number[],
  },
  {
    name: 'cubicSpline',
    // The spline's tridiagonal system has n - 2 unknowns, and the bridge tests that size.
    threshold: WASM_TRIDIAG_THRESHOLD + 2,
    sizes: [4096, 16384, 131072],
    prepare: (n) => {
      const xs = Array.from({ length: n }, (_, i) => i / n);
      return [xs, xs.map((x) => Math.sin(6 * x))];
    },
    call: (a) => api.cubicSpline(a[0], a[1]),
    numbers: (out) => [(out as (x: number) => number)(0.123456)],
  },
  {
    name: 'newtonInterp',
    threshold: WASM_INTERP_THRESHOLD,
    sizes: [256, 1024, 4096],
    prepare: (n) => {
      const xs = Array.from({ length: n }, (_, i) => Math.cos((Math.PI * (i + 0.5)) / n));
      return [xs, xs.map((x) => Math.exp(x)), 0.3];
    },
    call: (a) => api.newtonInterp(a[0], a[1], a[2]),
    numbers: one,
  },
  {
    name: 'lagrangeInterp',
    threshold: WASM_INTERP_THRESHOLD,
    sizes: [256, 1024, 4096],
    prepare: (n) => {
      const xs = Array.from({ length: n }, (_, i) => Math.cos((Math.PI * (i + 0.5)) / n));
      return [xs, xs.map((x) => Math.exp(x)), 0.3];
    },
    call: (a) => api.lagrangeInterp(a[0], a[1], a[2]),
    numbers: one,
  },
  {
    name: 'bitAnd(Int32Array)',
    threshold: WASM_BITWISE_THRESHOLD,
    sizes: [16384, 65536, 1_048_576],
    prepare: (n) => [
      Int32Array.from(uniform(n, -2e9, 2e9, 20)),
      Int32Array.from(uniform(n, -2e9, 2e9, 21)),
    ],
    call: (a) => api.bitAnd(a[0], a[1]),
    numbers: (out) => out as Int32Array,
  },
  {
    name: 'bitNot(Int32Array)',
    threshold: WASM_BITWISE_THRESHOLD,
    sizes: [16384, 65536, 1_048_576],
    prepare: (n) => [Int32Array.from(uniform(n, -2e9, 2e9, 22))],
    call: (a) => api.bitNot(a[0]),
    numbers: (out) => out as Int32Array,
  },
];

/** AS runtime and loader helpers: calling these alone does not mean a kernel ran. */
const HELPER = /^(__|alloc|free|memory$|reset|heap_reset$|get[A-Z]|set[A-Z])/;

/** Run `call` once with the loaded module wrapped, returning the kernel exports it called. */
async function kernelsCalled(call: () => unknown): Promise<string[]> {
  setTier(true);
  const real = wasmLoader.getModule();
  if (!real) throw new Error('opt-in bench: module is not loaded');
  const called = new Set<string>();
  // `instance.exports` is frozen, so a Proxy may not substitute its functions: hand the
  // bridges a plain copy whose kernel functions record their calls.
  const view: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(real)) {
    view[name] =
      typeof value === 'function'
        ? (...args: unknown[]) => {
            if (!HELPER.test(name)) called.add(name);
            return (value as Fn)(...args);
          }
        : value;
  }
  const loader = wasmLoader as unknown as { getModule?: () => unknown };
  loader.getModule = () => view;
  try {
    await call();
  } finally {
    setTier(true);
  }
  return [...called].sort();
}

function maxRelDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return Infinity;
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i]) && Number.isNaN(b[i])) continue;
    const d = Math.abs(a[i] - b[i]) / Math.max(1, Math.abs(a[i]));
    if (!(d <= m)) m = d;
  }
  return m;
}

/** Tier switch: "off" makes every bridge see no module, exactly as before `loadWasm()`. */
function setTier(on: boolean): void {
  const loader = wasmLoader as unknown as { getModule?: () => unknown };
  if (on)
    delete loader.getModule; // back to the prototype method
  else loader.getModule = () => null;
}

async function timeOnce(call: () => unknown): Promise<number> {
  const t0 = performance.now();
  await call();
  return performance.now() - t0;
}

/** Median off/on times with both tiers warmed and their reps interleaved ABBA. */
async function timeBothTiers(call: () => unknown, n: number): Promise<{ off: number; on: number }> {
  const reps = Math.max(8, defaultIterations(n));
  // Enough warm-up that V8 has optimized both paths even for small inputs, where a few
  // calls leave the JS loop unoptimized (about 90 ns/element instead of 10): at least 5
  // rounds, then up to 200 or 0.3 s, whichever comes first.
  const warmStart = performance.now();
  for (let w = 0; w < 200 && (w < 5 || performance.now() - warmStart < 300); w++) {
    setTier(false);
    await call();
    setTier(true);
    await call();
  }
  const off: number[] = [];
  const on: number[] = [];
  for (let r = 0; r < reps; r++) {
    const order = r % 2 === 0 ? [false, true] : [true, false];
    for (const tier of order) {
      setTier(tier);
      (tier ? on : off).push(await timeOnce(call));
    }
  }
  setTier(true);
  return { off: median(off), on: median(on) };
}

/** One measured row, also emitted as JSON so two runs can be compared. */
interface Row {
  name: string;
  n: number;
  unloadedMs: number;
  loadedMs: number;
  ratio: number;
  kernels: string[];
  relDiff: number;
}

export async function main(): Promise<void> {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const selected = only.length ? cases.filter((c) => only.includes(c.name)) : cases;
  if (!(await loadWasm())) throw new Error('opt-in bench: loadWasm() failed; build first');
  // Measure what each kernel can do, not what the dispatch policy currently allows: the
  // policy (functions/src/wasm/policy.ts) is derived from these numbers.
  const restorePolicy = overrideWasmPolicy({ '*': { min: 0 } });
  const rows: Row[] = [];
  console.log(
    'loadWasm() opt-in: public API, tier off vs on (interleaved). ratio = on/off (< 1: loading helps).'
  );
  for (const c of selected) {
    console.log(`\n${c.name} (WASM at n >= ${c.threshold})`);
    console.log('       n        off ms       on ms   ratio   kernels called');
    for (const n of c.sizes) {
      const input = c.prepare(n);
      const call = () => c.call(input);
      const kernels = await kernelsCalled(call);
      if (n >= c.threshold && kernels.length === 0) {
        throw new Error(`opt-in bench: ${c.name} at n=${n} did not reach WASM once loaded`);
      }
      setTier(false);
      const offOut = await call();
      setTier(true);
      const relDiff = maxRelDiff(c.numbers(offOut), c.numbers(await call()));
      const t = await timeBothTiers(call, n);
      const row: Row = {
        name: c.name,
        n,
        unloadedMs: t.off,
        loadedMs: t.on,
        ratio: t.on / t.off,
        kernels,
        relDiff,
      };
      rows.push(row);
      console.log(
        `${String(n).padStart(8)}   ${t.off.toFixed(3).padStart(11)}   ${t.on
          .toFixed(3)
          .padStart(9)}   ${row.ratio.toFixed(2).padStart(5)}   ${
          kernels.length ? kernels.join(',') : '(none: below threshold)'
        }${relDiff > 1e-9 ? `   max rel diff ${relDiff.toExponential(1)}` : ''}`
      );
    }
  }
  console.log(`\nOPT_IN_JSON ${JSON.stringify(rows)}`);
  restorePolicy();
  await computePool.terminate();
}

if (isMainModule(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
