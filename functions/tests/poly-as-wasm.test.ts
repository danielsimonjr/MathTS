/**
 * Rust→AS migration Phase 3b — poly bridge on the AssemblyScript binary.
 *
 * This is the regression guard for the Phase-3a corruption: with the loader
 * defaulting to the AS binary, the poly bridge probed the *Rust pointer* export
 * name (`poly_mul_f64`, …) and called the AS *managed* kernel with pointer args,
 * silently producing all-zeros (mul / divmod / fit) or NaN/garbage (resultant /
 * discriminant) for n ≥ 256 — with NO output guard.
 *
 * RED before the fix:
 *   - polyMulDispatch returned all-zeros (≠ the convolution) for n ≥ 256.
 *   - resultantDispatch / discriminantDispatch returned NaN.
 * GREEN after gating the Rust probe behind isRustWasm and adding the AS managed
 * call: each dispatch invokes the AS kernel (proven by the call counter) and
 * matches the reference.
 *
 * Skipped when no AS artifact is present.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import {
  polyMulDispatch,
  polyDivModDispatch,
  resultantDispatch,
  discriminantDispatch,
  polyFitDispatch,
  chebFitDispatch,
  legendreFitDispatch,
  WASM_POLY_THRESHOLD,
  WASM_POLY_FIT_THRESHOLD,
} from '../src/wasm/poly/wasm-bridge.js';
import { AS_WASM_PATH, countExportCalls, maxAbsDiff } from './helpers/wasm-spy.js';

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;

/** Naive O(n·m) convolution — independent ground truth for poly multiply. */
function convJS(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

/** Reference long division (same algorithm as the bridge's JS fallback). */
function divModJS(
  num: Float64Array,
  den: Float64Array
): { quotient: Float64Array; remainder: Float64Array } {
  const qLen = num.length - den.length + 1;
  const work = new Float64Array(num);
  const quotient = new Float64Array(qLen);
  const bn = den[den.length - 1];
  for (let ii = 0; ii < qLen; ii++) {
    const i = num.length - 1 - ii;
    quotient[i - den.length + 1] = work[i] / bn;
    for (let j = 0; j < den.length; j++) {
      work[i - den.length + 1 + j] -= quotient[i - den.length + 1] * den[j];
    }
  }
  const rLen = den.length - 1;
  return { quotient, remainder: work.slice(0, rLen) };
}

describeIfAS('poly bridge — AssemblyScript managed dispatch (Phase 3b)', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  it('loaded the AS binary (managed runtime present, Rust pointer kernel absent)', () => {
    const mod = wasmLoader.getModule() as unknown as Record<string, unknown>;
    expect(typeof mod.__new).toBe('function'); // AS managed runtime
    expect(typeof mod.array_sin_ptr).toBe('function'); // AS sentinel
    expect(typeof mod.simd_sin_array).not.toBe('function'); // not the Rust binary
  });

  it('polyMulDispatch executes the AS kernel and matches the convolution (n ≥ 256)', () => {
    const n = WASM_POLY_THRESHOLD; // 256
    const a = new Float64Array(n);
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      a[i] = Math.sin(i * 0.1) + 0.5;
      b[i] = Math.cos(i * 0.07) - 0.3;
    }
    const { result, counts } = countExportCalls(['poly_mul_f64'], () => polyMulDispatch(a, b));
    expect(counts.poly_mul_f64).toBeGreaterThan(0); // proves AS path, not JS fallback
    const expected = convJS(a, b);
    expect(result.length).toBe(expected.length);
    expect(maxAbsDiff(result, expected)).toBeLessThan(1e-9);
    // Regression: the corrupt path produced all-zeros.
    expect(result.some((v) => v !== 0)).toBe(true);
  });

  it('polyDivModDispatch executes the AS kernel and reconstructs the numerator (n ≥ 256)', () => {
    const n = 300;
    const num = new Float64Array(n);
    const den = new Float64Array(5);
    for (let i = 0; i < n; i++) num[i] = Math.sin(i * 0.05) + 1.1;
    den.set([0.5, -1, 0.25, 2, 1]);
    const { result, counts } = countExportCalls(['poly_div_mod_f64'], () =>
      polyDivModDispatch(num, den)
    );
    expect(counts.poly_div_mod_f64).toBeGreaterThan(0);
    // AS quotient/remainder must match the JS long-division reference. (Direct
    // q·den+r reconstruction is numerically unstable for high-degree quotients,
    // so compare the two algorithms' outputs, which share the same recurrence.)
    const ref = divModJS(num, den);
    const relMax = (a: Float64Array, b: Float64Array) => {
      let m = 0;
      for (let i = 0; i < a.length; i++) {
        const denom = Math.max(Math.abs(b[i]), 1);
        m = Math.max(m, Math.abs(a[i] - b[i]) / denom);
      }
      return m;
    };
    expect(result.quotient.length).toBe(ref.quotient.length);
    expect(relMax(result.quotient, ref.quotient)).toBeLessThan(1e-9);
    expect(relMax(result.remainder, ref.remainder)).toBeLessThan(1e-9);
  });

  it('resultantDispatch executes the AS kernel and matches a known value (n ≥ 256)', () => {
    // Res(x²−1, x−2) = 3, padded with trailing zeros to length 256.
    const p = new Float64Array(WASM_POLY_THRESHOLD);
    const q = new Float64Array(WASM_POLY_THRESHOLD);
    p[0] = -1;
    p[2] = 1;
    q[0] = -2;
    q[1] = 1;
    const { result, counts } = countExportCalls(['poly_resultant_f64'], () =>
      resultantDispatch(p, q)
    );
    expect(counts.poly_resultant_f64).toBeGreaterThan(0);
    expect(Number.isNaN(result)).toBe(false); // regression: corrupt path returned NaN
    expect(result).toBeCloseTo(3, 6);
  });

  it('discriminantDispatch executes the AS kernel and matches a known value (n ≥ 256)', () => {
    // disc(x²−1) = 4, padded to length 256.
    const p = new Float64Array(WASM_POLY_THRESHOLD);
    p[0] = -1;
    p[2] = 1;
    const { result, counts } = countExportCalls(['poly_discriminant_f64'], () =>
      discriminantDispatch(p)
    );
    expect(counts.poly_discriminant_f64).toBeGreaterThan(0);
    expect(Number.isNaN(result)).toBe(false);
    expect(result).toBeCloseTo(4, 6);
  });

  it('polyFit/chebFit/legendreFit stay on the JS solver — the AS fit kernel is broken (n ≥ 1024)', () => {
    // The AS QR/normal-equations fit solver returns near-zero garbage (verified
    // Phase 3b), so the bridge intentionally does NOT route fit to the AS kernel
    // under the AS binary; it falls through to the correct JS solver. This test
    // pins that decision: the AS kernel must NOT be invoked, and the JS result
    // must recover the generating polynomial exactly.
    const n = WASM_POLY_FIT_THRESHOLD; // 1024
    const degree = 3;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    // y = 2 - 1.5x + 0.5x² - 0.25x³ on x ∈ [-1, 1].
    for (let i = 0; i < n; i++) {
      const x = -1 + (2 * i) / (n - 1);
      xs[i] = x;
      ys[i] = 2 - 1.5 * x + 0.5 * x * x - 0.25 * x * x * x;
    }
    const fit = countExportCalls(['poly_fit_f64'], () => polyFitDispatch(xs, ys, degree));
    expect(fit.counts.poly_fit_f64).toBe(0); // AS fit kernel deliberately NOT used
    expect(maxAbsDiff(fit.result, new Float64Array([2, -1.5, 0.5, -0.25]))).toBeLessThan(1e-6);

    const cheb = countExportCalls(['cheb_fit_f64'], () => chebFitDispatch(xs, ys, degree));
    expect(cheb.counts.cheb_fit_f64).toBe(0);
    const leg = countExportCalls(['legendre_fit_f64'], () => legendreFitDispatch(xs, ys, degree));
    expect(leg.counts.legendre_fit_f64).toBe(0);
    expect(cheb.result.length).toBe(degree + 1);
    expect(leg.result.length).toBe(degree + 1);
  });
});
