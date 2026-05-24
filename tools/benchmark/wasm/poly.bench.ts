/**
 * Polynomial WASM kernel benchmark — Slice 3.7.
 *
 * Compares the pure-JS path against the WASM path for:
 *   • poly_mul_f64  — O(n·m) convolution
 *   • poly_div_mod_f64 — polynomial long division
 *
 * Run with:
 *   npx ts-node --esm tools/benchmark/wasm/poly.bench.ts
 *   (requires the Rust WASM artifact at /home/user/lib/wasm/mathts.wasm)
 *
 * Expected result: WASM wins above WASM_POLY_THRESHOLD (256 coefficients),
 * JS wins below.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Direct imports from source (pre-build).
import {
  polyMulDispatch,
  polyDivModDispatch,
  discriminantDispatch,
  resultantDispatch,
  polyFitDispatch,
  chebFitDispatch,
  legendreFitDispatch,
  WASM_POLY_THRESHOLD,
  WASM_POLY_FIT_THRESHOLD,
} from '../../../functions/src/wasm/poly/wasm-bridge.js';
import { wasmLoader } from '../../../functions/src/wasm/WasmLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

const RUNS = 20;

function randF64Array(n: number): Float64Array {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random() * 20 - 10;
  a[n - 1] = a[n - 1] === 0 ? 1 : a[n - 1]; // non-zero leading coeff
  return a;
}

/** Pure-JS poly multiply (baseline). */
function jsMul(a: Float64Array, b: Float64Array): Float64Array {
  if (a.length === 0 || b.length === 0) return new Float64Array([0]);
  const out = new Float64Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return out;
}

/** Pure-JS long division (baseline). */
function jsDivMod(num: Float64Array, den: Float64Array): void {
  const qLen = num.length >= den.length ? num.length - den.length + 1 : 0;
  const work = new Float64Array(num);
  const quot = new Float64Array(qLen);
  const bn = den[den.length - 1];
  for (let ii = 0; ii < qLen; ii++) {
    const i = num.length - 1 - ii;
    quot[i - den.length + 1] = work[i] / bn;
    for (let j = 0; j < den.length; j++)
      work[i - den.length + 1 + j] -= quot[i - den.length + 1] * den[j];
  }
}

/** Pure-JS resultant (Sylvester-matrix det) baseline. */
function jsResultant(p: Float64Array, q: Float64Array): number {
  let pm = p.length - 1;
  while (pm > 0 && p[pm] === 0) pm--;
  let qn = q.length - 1;
  while (qn > 0 && q[qn] === 0) qn--;
  const m = pm;
  const n = qn;
  if (m === 0 && n === 0) return 1;
  if (m === 0) return Math.pow(p[0], n);
  if (n === 0) return Math.pow(q[0], m);
  const size = m + n;
  const flat: number[] = new Array(size * size).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j <= m; j++) flat[i * size + (i + j)] = p[m - j];
  for (let i = 0; i < m; i++)
    for (let j = 0; j <= n; j++) flat[(n + i) * size + (i + j)] = q[n - j];
  let det = 1;
  for (let col = 0; col < size; col++) {
    let maxRow = col;
    let maxVal = Math.abs(flat[col * size + col]);
    for (let row = col + 1; row < size; row++) {
      const v = Math.abs(flat[row * size + col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    if (maxVal < 1e-15) return 0;
    if (maxRow !== col) {
      for (let k = 0; k < size; k++) {
        const tmp = flat[col * size + k];
        flat[col * size + k] = flat[maxRow * size + k];
        flat[maxRow * size + k] = tmp;
      }
      det = -det;
    }
    det *= flat[col * size + col];
    for (let row = col + 1; row < size; row++) {
      const factor = flat[row * size + col] / flat[col * size + col];
      for (let k = col; k < size; k++) flat[row * size + k] -= factor * flat[col * size + k];
    }
  }
  return det;
}

/** Pure-JS discriminant baseline. */
function jsDiscriminant(p: Float64Array): number {
  let end = p.length - 1;
  while (end > 0 && p[end] === 0) end--;
  const t = p.slice(0, end + 1);
  const deg = t.length - 1;
  if (deg < 1) return NaN;
  if (deg === 1) return 1;
  if (deg === 2) return t[1] * t[1] - 4 * t[2] * t[0];
  if (deg === 3) {
    const [d, c, b, a] = [t[0], t[1], t[2], t[3]];
    return (
      18 * a * b * c * d -
      4 * b * b * b * d +
      b * b * c * c -
      4 * a * c * c * c -
      27 * a * a * d * d
    );
  }
  const fp = new Float64Array(deg);
  for (let i = 1; i <= deg; i++) fp[i - 1] = t[i] * i;
  const res = jsResultant(t, fp);
  const an = t[t.length - 1];
  const sign = ((deg * (deg - 1)) / 2) % 2 === 0 ? 1 : -1;
  return (sign * res) / an;
}

function bench(label: string, fn: () => unknown, runs: number): number {
  // Warm-up.
  fn();
  fn();
  fn();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const elapsed = (performance.now() - t0) / runs;
  console.log(`  ${label.padEnd(40)} ${elapsed.toFixed(3)} ms/run`);
  return elapsed;
}

async function run(): Promise<void> {
  console.log('=== Polynomial WASM Kernel Benchmark ===');
  console.log(`  WASM_POLY_THRESHOLD = ${WASM_POLY_THRESHOLD}`);

  if (!WASM_PATH) {
    console.log('  WASM artifact not found — JS-only benchmark');
  } else {
    await wasmLoader.load(WASM_PATH);
    console.log('  Rust WASM artifact loaded');
  }

  const sizes = [64, 128, WASM_POLY_THRESHOLD, 512, 1024, 2048];

  for (const n of sizes) {
    const a = randF64Array(n);
    const b = randF64Array(n);
    const num = randF64Array(n * 2);
    const den = randF64Array(n);

    console.log(`\n--- n = ${n} (${n >= WASM_POLY_THRESHOLD ? 'above' : 'below'} threshold) ---`);

    const jsT = bench('poly_mul JS baseline', () => jsMul(a, b), RUNS);
    const wasmT = bench('poly_mul WASM dispatch', () => polyMulDispatch(a, b), RUNS);

    if (wasmT < jsT) {
      console.log(`  → WASM wins by ${(jsT / wasmT).toFixed(2)}×`);
    } else {
      console.log(`  → JS wins by ${(wasmT / jsT).toFixed(2)}× (expected below threshold)`);
    }

    const jsDivT = bench('poly_div_mod JS baseline', () => jsDivMod(num, den), RUNS);
    const wasmDivT = bench('poly_div_mod WASM dispatch', () => polyDivModDispatch(num, den), RUNS);

    if (wasmDivT < jsDivT) {
      console.log(`  → WASM div wins by ${(jsDivT / wasmDivT).toFixed(2)}×`);
    } else {
      console.log(
        `  → JS div wins by ${(wasmDivT / jsDivT).toFixed(2)}× (expected below threshold)`
      );
    }

    // discriminant / resultant (Slice 4.5)
    // Use degree-n polynomial for discriminant, pair for resultant.
    const jsDiscT = bench('discriminant JS baseline', () => jsDiscriminant(a), RUNS);
    const wasmDiscT = bench('discriminant WASM dispatch', () => discriminantDispatch(a), RUNS);

    if (wasmDiscT < jsDiscT) {
      console.log(`  → WASM disc wins by ${(jsDiscT / wasmDiscT).toFixed(2)}×`);
    } else {
      console.log(
        `  → JS disc wins by ${(wasmDiscT / jsDiscT).toFixed(2)}× (expected below threshold)`
      );
    }

    const jsResT = bench('resultant JS baseline', () => jsResultant(a, b), RUNS);
    const wasmResT = bench('resultant WASM dispatch', () => resultantDispatch(a, b), RUNS);

    if (wasmResT < jsResT) {
      console.log(`  → WASM res wins by ${(jsResT / wasmResT).toFixed(2)}×`);
    } else {
      console.log(
        `  → JS res wins by ${(wasmResT / jsResT).toFixed(2)}× (expected below threshold)`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// polyFit / chebFit / legendreFit benchmarks (Slice 5.4)
// ---------------------------------------------------------------------------

/** Pure-JS polynomial fit (normal equations, power basis). */
function jsPolyFit(xs: Float64Array, ys: Float64Array, degree: number): Float64Array {
  const n = xs.length;
  const k = degree + 1;
  const ATA: number[][] = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < n; i++) {
    const row: number[] = new Array(k);
    let xpow = 1;
    for (let j = 0; j < k; j++) {
      row[j] = xpow;
      xpow *= xs[i];
    }
    for (let j = 0; j < k; j++) {
      for (let l = 0; l < k; l++) ATA[j][l] += row[j] * row[l];
      ATA[j][k] += row[j] * ys[i];
    }
  }
  for (let col = 0; col < k; col++) {
    let maxRow = col;
    let maxVal = Math.abs(ATA[col][col]);
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(ATA[row][col]) > maxVal) {
        maxVal = Math.abs(ATA[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [ATA[col], ATA[maxRow]] = [ATA[maxRow], ATA[col]];
    for (let row = col + 1; row < k; row++) {
      const f = ATA[row][col] / ATA[col][col];
      for (let j = col; j <= k; j++) ATA[row][j] -= f * ATA[col][j];
    }
  }
  const coeffs = new Float64Array(k);
  for (let i = k - 1; i >= 0; i--) {
    coeffs[i] = ATA[i][k];
    for (let j = i + 1; j < k; j++) coeffs[i] -= ATA[i][j] * coeffs[j];
    coeffs[i] /= ATA[i][i];
  }
  return coeffs;
}

async function runFitBench(): Promise<void> {
  console.log('\n=== Polynomial Fit WASM Kernel Benchmark (Slice 5.4) ===');
  console.log(`  WASM_POLY_FIT_THRESHOLD = ${WASM_POLY_FIT_THRESHOLD}`);

  const fitSizes = [256, 512, WASM_POLY_FIT_THRESHOLD, 2048, 4096];
  const degree = 5;

  for (const n of fitSizes) {
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = (i / (n - 1)) * 2 - 1; // uniform in [-1, 1]
      ys[i] = 1 - xs[i] + 0.5 * xs[i] * xs[i];
    }

    console.log(
      `\n--- n = ${n} (${n >= WASM_POLY_FIT_THRESHOLD ? 'above' : 'below'} threshold) ---`
    );

    const jsT = bench('polyFit JS baseline', () => jsPolyFit(xs, ys, degree), RUNS);
    const wasmPolyT = bench('polyFit WASM dispatch', () => polyFitDispatch(xs, ys, degree), RUNS);
    const wasmChebT = bench('chebFit WASM dispatch', () => chebFitDispatch(xs, ys, degree), RUNS);
    const wasmLegT = bench(
      'legendreFit WASM dispatch',
      () => legendreFitDispatch(xs, ys, degree),
      RUNS
    );

    if (wasmPolyT < jsT) {
      console.log(`  → polyFit WASM wins by ${(jsT / wasmPolyT).toFixed(2)}×`);
    } else {
      console.log(
        `  → polyFit JS wins by ${(wasmPolyT / jsT).toFixed(2)}× (expected below threshold)`
      );
    }
    void wasmChebT;
    void wasmLegT;
  }
}

run()
  .then(() => runFitBench())
  .catch(console.error);
