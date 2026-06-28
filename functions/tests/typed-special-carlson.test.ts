/**
 * Tests for Carlson R-forms and incomplete elliptic integrals (Slice 6.4).
 *
 * Reference values:
 *   DLMF §19.16-§19.36 (Carlson forms and incomplete elliptic integrals)
 *   Abramowitz & Stegun §17 (elliptic integrals tables)
 *   Numerical Recipes §6.11 (algorithm reference)
 *
 * Tolerance:
 *   Carlson duplication algorithm converges to ~1e-10 relative error in 30
 *   iterations with threshold 0.0015 (NR §6.11 prescription).
 *   We test to 1e-9 to allow for platform floating-point variation.
 *
 * Known closed-form values used for testing:
 *   RC(0, 1) = π/2            (DLMF §19.20.3)
 *   RC(1, 1) = 1              (degenerate case)
 *   RF(0, 1, 2) ≈ 1.3110287771461  (DLMF §19.20.2)
 *   RD(0, 2, 1) ≈ 1.7972103521033  (DLMF §19.20.5)
 *   RF is symmetric in all three arguments
 *   F(π/2, m) = K(m)          (complete-incomplete consistency)
 *   E_incomplete(π/2, m) = E(m) (complete-incomplete consistency)
 *   F(0, m) = 0, E(0, m) = 0 (boundary at phi=0)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  carlsonRCJS,
  carlsonRFJS,
  carlsonRDJS,
  carlsonRJJS,
  ellipticFIncompleteJS,
  ellipticEIncompleteJS,
  ellipticPiIncompleteJS,
  carlsonRCDispatch,
  carlsonRFDispatch,
  carlsonRDDispatch,
  ellipticFIncompleteDispatch,
  ellipticEIncompleteDispatch,
  ellipticKJS,
  ellipticEJS,
  WASM_SPECIAL_THRESHOLD,
} from '../src/wasm/special/wasm-bridge.js';

const TOL = 1e-9;
const TOL_AGREE = 1e-12;
const PI = Math.PI;

// ---------------------------------------------------------------------------
// De-flake: warm the typed-module dynamic import once, up front.
//
// Suite 10 reaches the typed wrappers via `await import('../src/typed/
// special.js')`. The *first* such import transforms + evaluates a large
// dependency graph (typed-function + core); measured at ~4.6s of esbuild work
// even on an idle machine. Under heavy concurrent CPU load that first import
// alone can exceed Vitest's 5000ms per-test timeout, intermittently failing
// whichever typed scalar test triggers it first (e.g. "carlsonRC typed scalar:
// RC(0, 1) = π/2"). Warming it here, with a generous hook timeout, moves the
// one-time compile cost out of any per-test deadline so every `await import()`
// below resolves from cache and its assertion runs against a ready module
// deterministically. No assertion is changed; this only removes the
// load-induced timeout race.
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await import('../src/typed/special.js');
}, 120_000);

// ---------------------------------------------------------------------------
// Suite 1 — RC known values
// ---------------------------------------------------------------------------

describe('Carlson RC — known values (DLMF §19.20.3)', () => {
  it('RC(0, 1) = π/2', () => {
    const r = carlsonRCJS(new Float64Array([0]), new Float64Array([1]))[0];
    expect(Math.abs(r - PI / 2)).toBeLessThan(TOL);
  });

  it('RC(1, 1) = 1', () => {
    const r = carlsonRCJS(new Float64Array([1]), new Float64Array([1]))[0];
    expect(Math.abs(r - 1.0)).toBeLessThan(TOL);
  });

  it('RC(x, x) = 1/√x for x > 0', () => {
    for (const x of [0.25, 1.0, 4.0, 9.0]) {
      const r = carlsonRCJS(new Float64Array([x]), new Float64Array([x]))[0];
      expect(Math.abs(r - 1.0 / Math.sqrt(x))).toBeLessThan(TOL);
    }
  });

  it('RC(0, y) = π/(2√y) — DLMF 19.20.3', () => {
    for (const y of [1.0, 4.0, 0.25]) {
      const r = carlsonRCJS(new Float64Array([0]), new Float64Array([y]))[0];
      expect(Math.abs(r - PI / (2 * Math.sqrt(y)))).toBeLessThan(TOL);
    }
  });

  it('RC returns NaN for x < 0', () => {
    const r = carlsonRCJS(new Float64Array([-1]), new Float64Array([1]))[0];
    expect(isNaN(r)).toBe(true);
  });

  it('RC returns NaN for y = 0', () => {
    const r = carlsonRCJS(new Float64Array([1]), new Float64Array([0]))[0];
    expect(isNaN(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — RF known values
// ---------------------------------------------------------------------------

describe('Carlson RF — known values (DLMF §19.20.2)', () => {
  // RF(0, 1, 2) is a standard test value — closed form involves Gamma(1/4).
  // Numerical value from DLMF 19.20.2: RF(0,1,2) = 1.31102877714605990523...
  it('RF(0, 1, 2) ≈ 1.3110287771461', () => {
    const r = carlsonRFJS(new Float64Array([0]), new Float64Array([1]), new Float64Array([2]))[0];
    expect(Math.abs(r - 1.3110287771460598)).toBeLessThan(TOL);
  });

  // RF(x, x, x) = 1/√x
  it('RF(x, x, x) = 1/√x', () => {
    for (const x of [0.25, 1.0, 4.0]) {
      const r = carlsonRFJS(new Float64Array([x]), new Float64Array([x]), new Float64Array([x]))[0];
      expect(Math.abs(r - 1.0 / Math.sqrt(x))).toBeLessThan(TOL);
    }
  });

  // Symmetry: RF(x,y,z) = RF(y,x,z) = RF(z,y,x) etc.
  it('RF(x, y, z) is symmetric in all three arguments', () => {
    const x = 0.5;
    const y = 1.0;
    const z = 2.0;
    const r1 = carlsonRFJS(new Float64Array([x]), new Float64Array([y]), new Float64Array([z]))[0];
    const r2 = carlsonRFJS(new Float64Array([y]), new Float64Array([x]), new Float64Array([z]))[0];
    const r3 = carlsonRFJS(new Float64Array([z]), new Float64Array([y]), new Float64Array([x]))[0];
    expect(Math.abs(r1 - r2)).toBeLessThan(TOL_AGREE);
    expect(Math.abs(r1 - r3)).toBeLessThan(TOL_AGREE);
  });

  // RF(0, y, y) = π/(2√y) = RC(0, y)
  it('RF(0, y, y) = π/(2√y)', () => {
    for (const y of [0.5, 1.0, 2.0]) {
      const r = carlsonRFJS(new Float64Array([0]), new Float64Array([y]), new Float64Array([y]))[0];
      expect(Math.abs(r - PI / (2 * Math.sqrt(y)))).toBeLessThan(TOL);
    }
  });

  it('RF returns NaN for negative argument', () => {
    const r = carlsonRFJS(new Float64Array([-1]), new Float64Array([1]), new Float64Array([2]))[0];
    expect(isNaN(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — RD known values
// ---------------------------------------------------------------------------

describe('Carlson RD — known values (DLMF §19.20.5)', () => {
  // RD(0, 2, 1) ≈ 1.7972103521033... — from DLMF 19.20.5
  it('RD(0, 2, 1) ≈ 1.7972103521033', () => {
    const r = carlsonRDJS(new Float64Array([0]), new Float64Array([2]), new Float64Array([1]))[0];
    expect(Math.abs(r - 1.7972103521033)).toBeLessThan(1e-7);
  });

  // RD(x, x, x) = x^{-3/2}
  it('RD(x, x, x) = x^{-3/2}', () => {
    for (const x of [0.5, 1.0, 4.0]) {
      const r = carlsonRDJS(new Float64Array([x]), new Float64Array([x]), new Float64Array([x]))[0];
      expect(Math.abs(r - Math.pow(x, -1.5))).toBeLessThan(TOL);
    }
  });

  it('RD returns NaN for z ≤ 0', () => {
    const r = carlsonRDJS(new Float64Array([1]), new Float64Array([1]), new Float64Array([0]))[0];
    expect(isNaN(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — RJ regression against DLMF table
// ---------------------------------------------------------------------------

describe('Carlson RJ — regression (DLMF §19.20.4)', () => {
  // RJ(0, 1, 2, 3) from Carlson (1995) table: ≈ 0.77688623...
  // (computed from the duplication algorithm to full precision)
  it('RJ(0, 1, 2, 3) — regression test', () => {
    const r = carlsonRJJS(
      new Float64Array([0]),
      new Float64Array([1]),
      new Float64Array([2]),
      new Float64Array([3])
    )[0];
    // Accept 1e-6 to account for algorithm tolerance at this depth
    expect(Math.abs(r - 0.7768862345082)).toBeLessThan(1e-6);
  });

  it('RJ returns NaN for p = 0', () => {
    const r = carlsonRJJS(
      new Float64Array([1]),
      new Float64Array([1]),
      new Float64Array([1]),
      new Float64Array([0])
    )[0];
    expect(isNaN(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Incomplete elliptic integrals: boundary cases
// ---------------------------------------------------------------------------

describe('Incomplete elliptic integrals — boundary cases', () => {
  it('F(0, m) = 0 for any m', () => {
    for (const m of [0.0, 0.3, 0.7, 0.99]) {
      const r = ellipticFIncompleteJS(new Float64Array([0]), new Float64Array([m]))[0];
      expect(Math.abs(r)).toBeLessThan(1e-15);
    }
  });

  it('E_incomplete(0, m) = 0 for any m', () => {
    for (const m of [0.0, 0.3, 0.7]) {
      const r = ellipticEIncompleteJS(new Float64Array([0]), new Float64Array([m]))[0];
      expect(Math.abs(r)).toBeLessThan(1e-15);
    }
  });

  it('Pi(n, 0, m) = 0', () => {
    const r = ellipticPiIncompleteJS(
      new Float64Array([0.5]),
      new Float64Array([0]),
      new Float64Array([0.3])
    )[0];
    expect(Math.abs(r)).toBeLessThan(1e-15);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Complete-incomplete consistency: F(π/2, m) = K(m)
// ---------------------------------------------------------------------------

describe('F(π/2, m) = K(m) — consistency with complete integral', () => {
  for (const m of [0.1, 0.5, 0.9]) {
    it(`F(π/2, ${m}) = K(${m})`, () => {
      const fHalfPi = ellipticFIncompleteJS(
        new Float64Array([PI / 2]),
        new Float64Array([m])
      )[0];
      const kM = ellipticKJS(new Float64Array([m]))[0];
      expect(Math.abs(fHalfPi - kM)).toBeLessThan(TOL);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 7 — E_incomplete(π/2, m) = E(m) consistency
// ---------------------------------------------------------------------------

describe('E_incomplete(π/2, m) = E(m) — consistency with complete integral', () => {
  for (const m of [0.0, 0.5, 0.9]) {
    it(`E_incomplete(π/2, ${m}) = E(${m})`, () => {
      const eHalfPi = ellipticEIncompleteJS(
        new Float64Array([PI / 2]),
        new Float64Array([m])
      )[0];
      const eM = ellipticEJS(new Float64Array([m]))[0];
      expect(Math.abs(eHalfPi - eM)).toBeLessThan(1e-7);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 8 — Pi(n, π/2, m) tabulated value (A&S §17.7 table)
// ---------------------------------------------------------------------------

describe('Pi(n, π/2, m) — DLMF tabulated value', () => {
  // Pi(0.5, π/2, 0.5) can be computed numerically; we use the JS implementation
  // as oracle and check self-consistency, then verify the known identity
  // Pi(0, π/2, m) = K(m) (since the n=0 factor drops the (1-n sin²) denominator).
  it('Pi(0, π/2, m) = K(m) for any m ∈ (0,1)', () => {
    for (const m of [0.1, 0.5, 0.8]) {
      const piVal = ellipticPiIncompleteJS(
        new Float64Array([0]),
        new Float64Array([PI / 2]),
        new Float64Array([m])
      )[0];
      const kVal = ellipticKJS(new Float64Array([m]))[0];
      expect(Math.abs(piVal - kVal)).toBeLessThan(TOL);
    }
  });

  // Pi(0.5, π/2, 0) — when m=0, Pi(n, π/2, 0) = π / (2√(1-n)) for n < 1
  it('Pi(n, π/2, 0) = π / (2√(1-n)) for m = 0', () => {
    for (const n of [0.1, 0.3, 0.5, 0.8]) {
      const piVal = ellipticPiIncompleteJS(
        new Float64Array([n]),
        new Float64Array([PI / 2]),
        new Float64Array([0])
      )[0];
      const expected = PI / (2 * Math.sqrt(1 - n));
      expect(Math.abs(piVal - expected)).toBeLessThan(TOL);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 9 — Large array: WASM dispatch vs JS fallback (≥ 1024 elements)
// ---------------------------------------------------------------------------

function linspace(lo: number, hi: number, n: number): Float64Array {
  const out = new Float64Array(n);
  const step = (hi - lo) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = lo + i * step;
  return out;
}

describe('Large array path (≥ 1024) — WASM vs JS agreement', () => {
  const N = WASM_SPECIAL_THRESHOLD; // 1024

  it('RF large array: dispatch agrees with JS within 1e-12', () => {
    const xs = linspace(0.1, 1.0, N);
    const ys = linspace(0.5, 1.5, N);
    const zs = linspace(1.0, 2.0, N);
    const dr = carlsonRFDispatch(xs, ys, zs);
    const jr = carlsonRFJS(xs, ys, zs);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(1e-12);
    }
  });

  it('RD large array: dispatch agrees with JS within 1e-12', () => {
    const xs = linspace(0.1, 1.0, N);
    const ys = linspace(0.5, 1.5, N);
    const zs = linspace(0.5, 2.0, N);
    const dr = carlsonRDDispatch(xs, ys, zs);
    const jr = carlsonRDJS(xs, ys, zs);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(1e-12);
    }
  });

  it('RC large array: dispatch agrees with JS within 1e-12', () => {
    const xs = linspace(0.0, 1.0, N);
    const ys = linspace(0.5, 2.0, N);
    const dr = carlsonRCDispatch(xs, ys);
    const jr = carlsonRCJS(xs, ys);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(1e-12);
    }
  });

  it('ellipticF large array: dispatch agrees with JS within 1e-12', () => {
    const phis = linspace(0, PI / 2, N);
    const ms = linspace(0, 0.9, N);
    const dr = ellipticFIncompleteDispatch(phis, ms);
    const jr = ellipticFIncompleteJS(phis, ms);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(1e-12);
    }
  });

  it('ellipticEIncomplete large array: dispatch agrees with JS within 1e-12', () => {
    const phis = linspace(0, PI / 2, N);
    const ms = linspace(0, 0.9, N);
    const dr = ellipticEIncompleteDispatch(phis, ms);
    const jr = ellipticEIncompleteJS(phis, ms);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(dr[i] - jr[i])).toBeLessThan(1e-12);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 10 — Typed function exports (scalar + array overloads)
// ---------------------------------------------------------------------------

describe('Typed exports — scalar and array overloads', () => {
  it('carlsonRC typed scalar: RC(0, 1) = π/2', async () => {
    const { carlsonRC } = await import('../src/typed/special.js');
    const r = carlsonRC(0, 1) as number;
    expect(Math.abs(r - PI / 2)).toBeLessThan(TOL);
  });

  it('carlsonRF typed scalar: RF(0, 1, 2) ≈ 1.311028777146', async () => {
    const { carlsonRF } = await import('../src/typed/special.js');
    const r = carlsonRF(0, 1, 2) as number;
    expect(Math.abs(r - 1.3110287771460598)).toBeLessThan(TOL);
  });

  it('carlsonRD typed scalar: RD(0, 2, 1) ≈ 1.797210352', async () => {
    const { carlsonRD } = await import('../src/typed/special.js');
    const r = carlsonRD(0, 2, 1) as number;
    expect(Math.abs(r - 1.7972103521033)).toBeLessThan(1e-7);
  });

  it('carlsonRJ typed scalar: RJ(0, 1, 2, 3) ≈ 0.776886234', async () => {
    const { carlsonRJ } = await import('../src/typed/special.js');
    const r = carlsonRJ(0, 1, 2, 3) as number;
    expect(Math.abs(r - 0.7768862345082)).toBeLessThan(1e-6);
  });

  it('ellipticF typed scalar: F(π/2, 0.5) = K(0.5)', async () => {
    const { ellipticF, ellipticK } = await import('../src/typed/special.js');
    const f = ellipticF(PI / 2, 0.5) as number;
    const k = ellipticK(0.5) as number;
    expect(Math.abs(f - k)).toBeLessThan(TOL);
  });

  it('ellipticEIncomplete typed scalar: E_incomplete(π/2, 0.5) = E(0.5)', async () => {
    const { ellipticEIncomplete, ellipticE } = await import('../src/typed/special.js');
    const eInc = ellipticEIncomplete(PI / 2, 0.5) as number;
    const eComp = ellipticE(0.5) as number;
    expect(Math.abs(eInc - eComp)).toBeLessThan(1e-7);
  });

  it('ellipticPi typed scalar: Pi(0, π/2, 0.5) = K(0.5)', async () => {
    const { ellipticPi, ellipticK } = await import('../src/typed/special.js');
    const pi = ellipticPi(0, PI / 2, 0.5) as number;
    const k = ellipticK(0.5) as number;
    expect(Math.abs(pi - k)).toBeLessThan(TOL);
  });

  it('ellipticF typed array overload (≥ threshold) resolves correctly', async () => {
    const { ellipticF } = await import('../src/typed/special.js');
    const phis = linspace(0.1, PI / 2, WASM_SPECIAL_THRESHOLD);
    const ms = linspace(0.1, 0.9, WASM_SPECIAL_THRESHOLD);
    const result = ellipticF(phis, ms) as Float64Array;
    const jr = ellipticFIncompleteJS(phis, ms);
    for (let i = 0; i < phis.length; i++) {
      expect(Math.abs(result[i] - jr[i])).toBeLessThan(1e-12);
    }
  });

  it('carlsonRF typed array overload (≥ threshold) resolves correctly', async () => {
    const { carlsonRF } = await import('../src/typed/special.js');
    const N = WASM_SPECIAL_THRESHOLD;
    const xs = linspace(0.1, 1.0, N);
    const ys = linspace(0.5, 1.5, N);
    const zs = linspace(1.0, 2.0, N);
    const result = carlsonRF(xs, ys, zs) as Float64Array;
    const jr = carlsonRFJS(xs, ys, zs);
    for (let i = 0; i < N; i++) {
      expect(Math.abs(result[i] - jr[i])).toBeLessThan(1e-12);
    }
  });
});
