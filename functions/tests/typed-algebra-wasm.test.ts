/**
 * Dispatch-correctness tests for the polynomial WASM bridge (Slice 3.7).
 *
 * Strategy:
 *   1. Below-threshold paths — pure-JS fallback must be numerically
 *      correct for small inputs (no WASM module needed).
 *   2. Above-threshold paths — when the Rust WASM artifact is present,
 *      verify the WASM path produces the same result as the JS path.
 *      The suite is skipped (describe.skip) for the WASM-dependent
 *      group when the artifact is absent.
 *   3. Round-trip invariant: for any num and den with deg(den) > 0,
 *      `num = den · quotient + remainder` and `deg(remainder) < deg(den)`.
 *   4. Edge cases: empty / zero / length-1 polynomials.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import {
  polymul,
  polynomialGCD,
  polynomialLCM,
  polynomialQuotient,
  polynomialRemainder,
  polyadd,
} from '../src/typed/algebra.js';
import { WASM_POLY_THRESHOLD, resetPolyWasm } from '../src/wasm/poly/wasm-bridge.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';

// ---------------------------------------------------------------------------
// WASM artifact location
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = (() => {
  const candidate = resolve(here, '../../../lib/wasm/mathts.wasm');
  return existsSync(candidate) ? candidate : null;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** JS-oracle poly mul (no WASM). */
function jsMul(a: number[], b: number[]): number[] {
  if (a.length === 0 || b.length === 0) return [0];
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] += a[i] * b[j];
    }
  }
  return out;
}

/** JS-oracle poly div-mod (no WASM). */
function jsDivMod(a: number[], b: number[]): [number[], number[]] {
  if (b.length === 0) throw new Error('division by zero');
  if (a.length < b.length) return [[], [...a]];
  const rem = [...a];
  const qLen = a.length - b.length + 1;
  const quot = new Array(qLen).fill(0);
  const bn = b[b.length - 1];
  for (let i = qLen - 1; i >= 0; i--) {
    quot[i] = rem[i + b.length - 1] / bn;
    for (let j = 0; j < b.length; j++) rem[i + j] -= quot[i] * b[j];
  }
  return [quot, rem.slice(0, b.length - 1)];
}

/** Poly eval at x (for verification). */
function polyEval(coeffs: number[], x: number): number {
  let r = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) r = r * x + coeffs[i];
  return r;
}

/** Absolute max difference between two arrays (same length). */
function maxDiff(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  return d;
}

// ---------------------------------------------------------------------------
// Round-trip verifier: num ≡ den · quot + rem  and  deg(rem) < deg(den)
// ---------------------------------------------------------------------------
function verifyRoundTrip(num: number[], den: number[], tol: number = 1e-9): void {
  const quot = polynomialQuotient(num, den);
  const rem = polynomialRemainder(num, den);

  // deg(rem) < deg(den)
  const effDenDeg = den.length - 1;
  const effRemDeg = rem.filter((_, i) => i === rem.length - 1 && rem[i] !== 0).length;
  const remDeg = (() => {
    let d = rem.length - 1;
    while (d > 0 && rem[d] === 0) d--;
    return d;
  })();
  expect(remDeg).toBeLessThan(effDenDeg);

  // num(x) ≈ den(x)·quot(x) + rem(x)  for a handful of test points
  const xs = [-2, -1, 0, 0.5, 1, 2, Math.PI];
  for (const x of xs) {
    const lhs = polyEval(num, x);
    const denQ = jsMul(den, quot);
    const rhs = polyEval(polyadd(denQ, rem), x);
    expect(Math.abs(lhs - rhs)).toBeLessThan(tol);
  }
}

// ===========================================================================
// Suite 1: Pure-JS / below-threshold correctness (no WASM artifact needed)
// ===========================================================================

describe('polynomial algebra — below-threshold correctness (pure JS)', () => {
  it('polymul: (1+x)^2 = 1 + 2x + x^2', () => {
    expect(polymul([1, 1], [1, 1])).toEqual([1, 2, 1]);
  });

  it('polymul: [1] × [1,2,3] = [1,2,3]', () => {
    expect(polymul([1], [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('polymul: empty polynomial gives [0]', () => {
    expect(polymul([], [1, 2])).toEqual([0]);
    expect(polymul([1, 2], [])).toEqual([0]);
  });

  it('polymul: zero polynomial × anything = [0]', () => {
    expect(polymul([0], [3, 4, 5])).toEqual([0]);
  });

  it('polymul matches JS oracle for degree-5 × degree-4 product', () => {
    const a = [1, -2, 3, -4, 5, -6];
    const b = [2, 0, -1, 3, 7];
    const oracle = jsMul(a, b);
    const result = polymul(a, b);
    expect(result.length).toBe(oracle.length);
    expect(maxDiff(result, oracle)).toBeLessThan(1e-12);
  });

  it('polynomialQuotient: (x^2-1) / (x-1) = x+1', () => {
    expect(polynomialQuotient([-1, 0, 1], [-1, 1])).toEqual([1, 1]);
  });

  it('polynomialRemainder: (x^2-1) % (x-1) = 0', () => {
    const rem = polynomialRemainder([-1, 0, 1], [-1, 1]);
    // Remainder should be effectively zero
    for (const c of rem) expect(Math.abs(c)).toBeLessThan(1e-12);
  });

  it('polynomialQuotient: degree(num) < degree(den) → [0]', () => {
    const q = polynomialQuotient([1, 2], [1, 0, 1]);
    expect(q).toEqual([0]);
  });

  it('polynomialRemainder: degree(num) < degree(den) → num', () => {
    const rem = polynomialRemainder([1, 2], [1, 0, 1]);
    expect(rem).toEqual([1, 2]);
  });

  it('polynomialGCD([x^2-1], [x-1]) = monic GCD x-1', () => {
    const g = polynomialGCD([-1, 0, 1], [-1, 1]);
    // Should be [-1, 1] or scaled to monic [−1, 1]
    const deg = g.length - 1;
    expect(deg).toBe(1);
    // Eval at x=1 should be 0
    expect(Math.abs(polyEval(g, 1))).toBeLessThan(1e-12);
  });

  it('polynomialLCM([x-1],[x+1]) has degree 2 and roots at ±1', () => {
    const lcm = polynomialLCM([-1, 1], [1, 1]);
    expect(lcm.length).toBe(3); // degree 2
    expect(Math.abs(polyEval(lcm, 1))).toBeLessThan(1e-10);
    expect(Math.abs(polyEval(lcm, -1))).toBeLessThan(1e-10);
  });

  it('round-trip: (x^3-6x^2+11x-6) / (x-1)', () => {
    // (x-1)(x-2)(x-3) = x^3 - 6x^2 + 11x - 6
    verifyRoundTrip([-6, 11, -6, 1], [-1, 1]);
  });

  it('round-trip: (x^4+x^2+1) / (x^2+x+1)', () => {
    verifyRoundTrip([1, 0, 1, 0, 1], [1, 1, 1]);
  });

  it('single-coefficient polynomials: [3] * [4] = [12]', () => {
    expect(polymul([3], [4])).toEqual([12]);
  });

  it('polynomialGCD(p, p) = monic p (for monic p)', () => {
    const p = [-2, 1]; // x - 2
    const g = polynomialGCD(p, p);
    // leading coeff should be 1
    expect(g[g.length - 1]).toBeCloseTo(1, 10);
  });
});

// ===========================================================================
// Suite 2: Above-threshold WASM dispatch (requires Rust artifact)
// ===========================================================================

const describeIfWasm = WASM_PATH !== null ? describe : describe.skip;

describeIfWasm('polynomial algebra — above-threshold WASM dispatch', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  /**
   * Build a random polynomial of given degree with integer coefficients
   * so that exact multiplication is representable in IEEE-754 double.
   */
  function randPoly(degree: number, scale: number = 10): number[] {
    const coeffs = [];
    for (let i = 0; i <= degree; i++) {
      coeffs.push(Math.round((Math.random() - 0.5) * 2 * scale));
    }
    // Ensure leading coefficient is non-zero.
    coeffs[degree] = coeffs[degree] === 0 ? 1 : coeffs[degree];
    return coeffs;
  }

  const N = WASM_POLY_THRESHOLD + 10; // just above threshold

  it('polymul WASM path matches JS oracle for n >= threshold', () => {
    const a = randPoly(N);
    const b = randPoly(N);
    const oracle = jsMul(a, b);
    const result = polymul(a, b);
    expect(result.length).toBe(oracle.length);
    // For integer coefficients, result should be exact.
    expect(maxDiff(result, oracle)).toBeLessThan(1e-6);
  });

  it('polyDivMod WASM path round-trip for large num', () => {
    // num = den * (x^N + 1), so quotient should be [1,0,...,0,1] and rem = 0
    const den = randPoly(5);
    const scale = randPoly(N);
    const num = polymul(den, scale); // guaranteed exact divisible
    verifyRoundTrip(num, den, 1e-6);
  });

  it('polynomialQuotient WASM path matches JS oracle', () => {
    const den = [1, 1]; // x + 1
    // Make a polynomial divisible by (x+1): use (x+1)*(x^N + random lower)
    const mult = randPoly(N);
    const num = polymul(den, mult);
    const [jsQuot] = jsDivMod(num, den);
    const wasmQuot = polynomialQuotient(num, den);
    expect(wasmQuot.length).toBe(jsQuot.length);
    expect(maxDiff(wasmQuot, jsQuot)).toBeLessThan(1e-6);
  });

  it('polynomialGCD large polynomial still computes correctly', () => {
    // GCD([x-1]*[x+1], [x-1]) = x-1
    const xm1 = [-1, 1];
    const xp1 = [1, 1];
    const bigPoly = polymul(xm1, randPoly(N - 2));
    const g = polynomialGCD(bigPoly, randPoly(3, 5));
    // GCD should divide bigPoly
    const rem = polynomialRemainder(bigPoly, g);
    const remNorm = Math.max(...rem.map(Math.abs));
    expect(remNorm).toBeLessThan(1e-6);
    void xp1; // suppress unused-var lint
  });

  it('below-threshold path still works after WASM load (no regression)', () => {
    // Small inputs must still produce correct results when WASM is loaded.
    expect(polymul([1, 1], [1, 1])).toEqual([1, 2, 1]);
    expect(polynomialQuotient([-1, 0, 1], [-1, 1])).toEqual([1, 1]);
  });
});

// ===========================================================================
// Suite 3: Fallback when WASM module not loaded
// ===========================================================================

describe('polynomial algebra — WASM fallback (module not loaded)', () => {
  beforeAll(() => {
    resetPolyWasm(); // ensure no module is loaded
  });

  afterAll(() => {
    resetPolyWasm();
  });

  it('polymul above threshold falls back to JS when WASM not loaded', () => {
    const N = WASM_POLY_THRESHOLD + 1;
    const a = new Array(N).fill(0).map((_, i) => (i % 3) - 1);
    const b = new Array(N).fill(0).map((_, i) => (i % 5) - 2);
    a[a.length - 1] = a[a.length - 1] === 0 ? 1 : a[a.length - 1];
    b[b.length - 1] = b[b.length - 1] === 0 ? 1 : b[b.length - 1];
    const oracle = jsMul(a, b);
    const result = polymul(a, b);
    expect(result.length).toBe(oracle.length);
    expect(maxDiff(result, oracle)).toBeLessThan(1e-10);
  });

  it('polynomialQuotient above threshold falls back correctly', () => {
    const den = [1, 2, 1]; // (1+x)^2
    const mult = new Array(WASM_POLY_THRESHOLD + 5).fill(1);
    const num = polymul(den, mult);
    const q = polynomialQuotient(num, den);
    // Quotient should be mult (≈ all 1s, trimmed)
    const multTrimmed = mult.slice(); // already no leading zeros
    expect(q.length).toBe(multTrimmed.length);
    expect(maxDiff(q, multTrimmed)).toBeLessThan(1e-9);
  });
});
