/**
 * Dogfood batch I (special functions): non-finite results, array work bounds, range losses.
 *
 * Reference values come from mpmath 1.3.0, SciPy 1.16.3 and exact integer arithmetic (Python).
 * No test asserts a wall-clock time. A call that must finish at once shows it by returning
 * (or throwing) inside the default test timeout.
 */
import { describe, it, expect } from 'vitest';
import { besselJ, besselY, chebyshevT } from '../src/typed/special.js';
import { workerKernel } from '../src/typed/worker-kernels.js';
import { besselYnJS } from '../src/wasm/special/wasm-bridge.js';
import {
  sphericalBesselJ,
  sphericalBesselI,
  sphericalBesselK,
  sphericalBesselY,
} from '../src/special/spherical-bessel.js';

/** Relative error |a / b - 1|. */
const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('#1116 Bessel and Chebyshev results that were NaN', () => {
  describe('besselJ(nu, x) for a real order nu > 0 and a tiny x', () => {
    it('besselJ(0.5, 1e-300) matches mpmath', () => {
      expect(rel(besselJ(0.5, 1e-300) as number, 7.978845608028654e-151)).toBeLessThan(1e-14);
    });
    it('besselJ(2.5, 1e-300) is 0 (the true value 5.3e-752 underflows)', () => {
      expect(besselJ(2.5, 1e-300)).toBe(0);
    });
    it('besselJ(1.5, 1e-150) matches mpmath', () => {
      expect(rel(besselJ(1.5, 1e-150) as number, 2.659615202676218e-226)).toBeLessThan(2e-14);
    });
    it('besselJ(0.5, 1e-20) matches mpmath', () => {
      expect(rel(besselJ(0.5, 1e-20) as number, 7.978845608028654e-11)).toBeLessThan(1e-14);
    });
    it('the worker kernel of besselJ gives the same value as the scalar', () => {
      const kernel = new Function(`return ${workerKernel('besselJ', 0.5)}`)() as (
        x: number
      ) => number;
      expect(rel(kernel(1e-300), 7.978845608028654e-151)).toBeLessThan(1e-14);
      expect(kernel(1e-300)).toBe(besselJ(0.5, 1e-300));
      expect(kernel(1e-20)).toBe(besselJ(0.5, 1e-20));
    });
    it('the worker kernel of besselY still evaluates (it lists besselJRealOrder)', () => {
      const kernel = new Function(`return ${workerKernel('besselY', 0.5)}`)() as (
        x: number
      ) => number;
      expect(kernel(1e-3)).toBe(besselY(0.5, 1e-3));
    });
  });

  describe('sphericalBesselJ and sphericalBesselI for a tiny x', () => {
    it('sphericalBesselJ(1, 1e-300) matches mpmath', () => {
      expect(rel(sphericalBesselJ(1, 1e-300), 3.3333333333333334e-301)).toBeLessThan(1e-15);
    });
    it('sphericalBesselJ(3, 1e-300) is 0 (the true value underflows)', () => {
      expect(sphericalBesselJ(3, 1e-300)).toBe(0);
    });
    it('sphericalBesselJ(3, 1e-100) matches mpmath', () => {
      expect(rel(sphericalBesselJ(3, 1e-100), 9.523809523809524e-303)).toBeLessThan(1e-14);
    });
    it('sphericalBesselI(1, 1e-300) matches mpmath', () => {
      expect(rel(sphericalBesselI(1, 1e-300), 3.3333333333333334e-301)).toBeLessThan(1e-15);
    });
    it('sphericalBesselI(2, 1e-300) is 0 (the true value underflows)', () => {
      expect(sphericalBesselI(2, 1e-300)).toBe(0);
    });
    it('sphericalBesselJ(5, 0.5) matches mpmath (series path, normal x)', () => {
      expect(rel(sphericalBesselJ(5, 0.5), 2.9774668754574457e-6)).toBeLessThan(1e-14);
    });
    it('a negative x keeps the parity (-1)^n', () => {
      expect(sphericalBesselJ(1, -1e-300)).toBe(-sphericalBesselJ(1, 1e-300));
      expect(sphericalBesselJ(2, -0.5)).toBe(sphericalBesselJ(2, 0.5));
      expect(sphericalBesselI(1, -1e-300)).toBe(-sphericalBesselI(1, 1e-300));
    });
  });

  describe('sphericalBesselY overflow', () => {
    it('sphericalBesselY(50, 1e-10) is -Infinity', () => {
      expect(sphericalBesselY(50, 1e-10)).toBe(-Infinity);
    });
    it('sphericalBesselY(20, 1e-10) is finite and matches mpmath (control)', () => {
      expect(rel(sphericalBesselY(20, 1e-10), -3.1983098677287777e233)).toBeLessThan(1e-13);
    });
    it('sphericalBesselY keeps the parity y_n(-x) = (-1)^(n+1) y_n(x) at overflow', () => {
      expect(sphericalBesselY(51, -1e-10)).toBe(-Infinity);
      expect(sphericalBesselY(50, -1e-10)).toBe(Infinity);
    });
    it('sphericalBesselY(400, 1) is -Infinity (SciPy spherical_yn gives -inf)', () => {
      expect(sphericalBesselY(400, 1)).toBe(-Infinity);
    });
  });

  describe('sphericalBesselI for a large x', () => {
    it('sphericalBesselI(1000, 1000) matches mpmath', () => {
      expect(rel(sphericalBesselI(1000, 1000), 6.9454341175993605e227)).toBeLessThan(1e-12);
    });
    it('sphericalBesselI(5000, 1000) is 0 (the true value 8.4e-2812 underflows)', () => {
      expect(sphericalBesselI(5000, 1000)).toBe(0);
    });
    it('sphericalBesselI(10, 800) is Infinity (the true value 1.59e344 overflows)', () => {
      expect(sphericalBesselI(10, 800)).toBe(Infinity);
    });
    it('sphericalBesselI(1001, -1000) is the negative of sphericalBesselI(1001, 1000)', () => {
      const v = sphericalBesselI(1001, 1000);
      expect(Number.isFinite(v)).toBe(true);
      expect(sphericalBesselI(1001, -1000)).toBe(-v);
    });
  });

  describe('sphericalBesselK for a large x', () => {
    it('sphericalBesselK(1000, 1000) matches mpmath', () => {
      expect(rel(sphericalBesselK(1000, 1000), 7.994050611016102e-235)).toBeLessThan(1e-12);
    });
    it('sphericalBesselK(3, 800) is 0 (the true value 7.3e-351 underflows)', () => {
      expect(sphericalBesselK(3, 800)).toBe(0);
    });
    it('sphericalBesselK(0, 1000) is 0 (the true value 8e-438 underflows)', () => {
      expect(sphericalBesselK(0, 1000)).toBe(0);
    });
    it('sphericalBesselK(1e8, 1e9) is 0 at once: the upper bound of k_n is below the smallest double', () => {
      expect(sphericalBesselK(1e8, 1e9)).toBe(0);
    });
    it('sphericalBesselK(1e8, Infinity) is 0 at once', () => {
      expect(sphericalBesselK(1e8, Infinity)).toBe(0);
    });
  });

  describe('chebyshevT for |x| > 1 after the overflow', () => {
    it('chebyshevT(1000, 1.5) is Infinity', () => {
      expect(chebyshevT(1000, 1.5)).toBe(Infinity);
    });
    it('chebyshevT(1001, -1.5) is -Infinity', () => {
      expect(chebyshevT(1001, -1.5)).toBe(-Infinity);
    });
    it('chebyshevT(1000, -1.5) is Infinity', () => {
      expect(chebyshevT(1000, -1.5)).toBe(Infinity);
    });
    it('chebyshevT(2, 1e200) and chebyshevT(3, -1e200) overflow with the right sign (pins)', () => {
      expect(chebyshevT(2, 1e200)).toBe(Infinity);
      expect(chebyshevT(3, -1e200)).toBe(-Infinity);
    });
    it('chebyshevT(10, 1.5) is exact (control)', () => {
      expect(rel(chebyshevT(10, 1.5) as number, 7563.5)).toBeLessThan(1e-14);
    });
    it('the Float64Array form gives the same overflow values', () => {
      expect(Array.from(chebyshevT(1000, new Float64Array([1.5, -1.5])) as Float64Array)).toEqual([
        Infinity,
        Infinity,
      ]);
      expect(Array.from(chebyshevT(1001, new Float64Array([1.5, -1.5])) as Float64Array)).toEqual([
        Infinity,
        -Infinity,
      ]);
    });
  });
});

describe('#1132 besselJ and besselY: one work bound per array call', () => {
  const fill = (len: number, v: number) => new Float64Array(len).fill(v);

  it('besselY(2.4e9, 1024 elements at 5e9) throws a RangeError before any recurrence runs', () => {
    expect(() => besselY(2.4e9, fill(1024, 5e9))).toThrow(RangeError);
  });
  it('besselJ(2.4e9, 1024 elements at 5e9) throws a RangeError before any recurrence runs', () => {
    expect(() => besselJ(2.4e9, fill(1024, 5e9))).toThrow(RangeError);
  });
  it('besselJ and besselY with 2 elements (below the array threshold) throw too', () => {
    expect(() => besselJ(2.4e9, fill(2, 5e9))).toThrow(RangeError);
    expect(() => besselY(2.4e9, fill(2, 5e9))).toThrow(RangeError);
  });
  it('the message names the order, the element count and the per-call maximum', () => {
    expect(() => besselJ(2.4e9, fill(1024, 5e9))).toThrow(
      /besselJ: order 2400000000 over 1024 elements needs about \d+ recurrence steps, above the supported maximum of 2500000000 per call/
    );
  });
  it('a downward sweep over many elements throws (x just below n)', () => {
    expect(() => besselJ(5e8, fill(8, 5e8 - 1))).toThrow(/per call/);
  });
  it('an element with its own limit error keeps its own message', () => {
    expect(() => besselJ(3e9, fill(4, 5e9))).toThrow(/besselJ: n = 3000000000 exceeds/);
    expect(() => besselY(3e9, fill(2048, 5))).toThrow(/besselY: n = 3000000000 exceeds/);
  });
  it('besselJ(2.4e9, 2048 elements at 1000) is 0 for every element (zero bound, no steps)', () => {
    const r = besselJ(2.4e9, fill(2048, 1000)) as Float64Array;
    expect(r.length).toBe(2048);
    expect(r.every((v) => v === 0)).toBe(true);
  });
  it('besselY(2e9, 2048 elements at 1) equals the scalar rule (overflow exit, about 200 steps)', () => {
    const r = besselY(2e9, fill(2048, 1)) as Float64Array;
    const want = besselYnJS(2e9, fill(2048, 1));
    expect(r.every((v, i) => Object.is(v, want[i]))).toBe(true);
  });
  it('besselJ(5, [1, 2, 3]) equals the scalars', () => {
    const r = besselJ(5, new Float64Array([1, 2, 3])) as Float64Array;
    expect(Array.from(r)).toEqual([besselJ(5, 1), besselJ(5, 2), besselJ(5, 3)]);
  });
  it('a total below the maximum passes: besselJ(2, 1e6 elements) runs', () => {
    const r = besselJ(2, fill(1_000_000, 0.5)) as Float64Array;
    expect(r.length).toBe(1_000_000);
  });
});
