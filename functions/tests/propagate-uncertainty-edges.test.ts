/**
 * #910 (review): edge inputs of `propagateUncertainty` for a function and for constants.
 *
 * Each case is an input that returned a wrong number, a silent zero or a misleading
 * error before:
 *   - a positional callback `(m, c) => ...` receives one record, so it computed NaN and the
 *     error named a partial instead of the callback shape;
 *   - a covariance that left a constant's own uncertainty out gave sigma 0 without a word;
 *   - the central-difference step ignored the scale of the function, so `exp(1e10 x)` gave
 *     a zero or an overflow;
 *   - a result with an underflowed step was NaN, and an overflowed sigma was Infinity;
 *   - a negative variance of 1e-40 counted as rounding because the tolerance was absolute.
 */
import { describe, it, expect } from 'vitest';
import {
  electronMass,
  speedOfLight,
  planckTime,
  propagateUncertainty as propagate,
} from '../src/index.js';

type Values = Record<string, number>;
const propagateUncertainty = propagate as (
  expr: string | ((values: Values) => number),
  values: Record<string, unknown>,
  sigmas?: Record<string, number>,
  options?: { covariance?: number[][]; relativeStep?: number }
) => {
  value: number;
  sigma: number;
  partials: Record<string, number>;
  flat?: string[];
};

describe('a positional callback is named as the cause (#910)', () => {
  it('names the record form when the callback computes NaN from one record', () => {
    const positional = (m: number, c: number): number => m * c * c;
    expect(() =>
      propagateUncertainty(positional as never, { m: electronMass, c: speedOfLight })
    ).toThrow(/\(\{m, c\}\) =>/);
  });

  it('keeps the record form working', () => {
    const result = propagateUncertainty((v: Values) => v.m * v.c * v.c, {
      m: electronMass,
      c: speedOfLight,
    });
    expect(Number.isFinite(result.sigma)).toBe(true);
  });
});

describe('a covariance does not drop the uncertainty of a constant (#910)', () => {
  it('throws, naming the input, when the diagonal leaves out a constant uncertainty', () => {
    expect(() =>
      propagateUncertainty((v: Values) => v.m, { m: electronMass }, undefined, {
        covariance: [[0]],
      })
    ).toThrow(/values\.m/);
  });

  it('takes the variance the covariance states for that constant', () => {
    const result = propagateUncertainty((v: Values) => v.m, { m: electronMass }, undefined, {
      covariance: [[1e-80]],
    });
    expect(result.sigma / 1e-40).toBeCloseTo(1, 6);
  });

  it('accepts a zero diagonal for an input that is a plain number', () => {
    const result = propagateUncertainty((v: Values) => v.a + v.b, { a: 1, b: 2 }, undefined, {
      covariance: [
        [0, 0],
        [0, 4],
      ],
    });
    expect(result.sigma).toBeCloseTo(2, 6);
  });
});

describe('the finite-difference step follows the scale of the input and of f (#910)', () => {
  const steep = (v: Values): number => Math.exp(1e10 * v.x);

  it('gives the partial of exp(1e10 x) at x = 1e-20 (it was 0)', () => {
    const result = propagateUncertainty(steep, { x: 1e-20 }, { x: 1e-20 });
    expect(result.partials.x / 1e10).toBeCloseTo(1, 5);
    expect(result.sigma / 1e-10).toBeCloseTo(1, 5);
  });

  it('gives the partial of exp(1e10 x) at x = 0, where the step overflowed', () => {
    const wide = propagateUncertainty(steep, { x: 0 }, { x: 1 });
    expect(wide.partials.x / 1e10).toBeCloseTo(1, 5);
    const narrow = propagateUncertainty(steep, { x: 0 }, { x: 1e-10 });
    expect(narrow.partials.x / 1e10).toBeCloseTo(1, 5);
  });

  it('gives the partial of a linear function at a tiny constant', () => {
    const result = propagateUncertainty((v: Values) => 3 * v.x, { x: planckTime }, { x: 1e-47 });
    expect(result.partials.x).toBeCloseTo(3, 6);
    expect(result.flat).toBeUndefined();
  });

  it('flags an input that the function does not depend on, and still returns 0', () => {
    const result = propagateUncertainty((v: Values) => 2 * v.a, { a: 1, b: 5 }, { a: 0.1, b: 0.1 });
    expect(result.partials.b).toBe(0);
    expect(result.flat).toEqual(['b']);
    expect(result.partials.a).toBeCloseTo(2, 6);
  });

  it('does not flag a function that depends on every input', () => {
    const result = propagateUncertainty((v: Values) => v.a * v.b, { a: 2, b: 3 }, { a: 1, b: 1 });
    expect(result.flat).toBeUndefined();
  });
});

describe('the result is finite or the call throws (#910)', () => {
  it('does not return NaN for a subnormal input', () => {
    const result = propagateUncertainty((v: Values) => v.x * v.x, { x: 5e-324 }, { x: 1e-324 });
    expect(Number.isFinite(result.sigma)).toBe(true);
    expect(Number.isFinite(result.partials.x)).toBe(true);
  });

  it('throws a RangeError when the sigma overflows', () => {
    // (1e10 * 1e150)^2 overflows a double, so the variance is Infinity.
    expect(() => propagateUncertainty((v: Values) => 1e10 * v.x, { x: 1 }, { x: 1e150 })).toThrow(
      RangeError
    );
    expect(() => propagateUncertainty((v: Values) => 1e10 * v.x, { x: 1 }, { x: 1e150 })).toThrow(
      /not finite/
    );
  });

  it('throws for an input near the largest double, where f overflows at every step', () => {
    expect(() =>
      propagateUncertainty((v: Values) => v.x * v.x, { x: Number.MAX_VALUE }, { x: 1 })
    ).toThrow(/not a finite number/);
  });
});

describe('the negative-variance tolerance is relative to the variance scale (#910)', () => {
  it('throws for a covariance that is not positive semidefinite at a scale of 1e-40', () => {
    // correlation 2: g' S g = 1e-40 + 1e-40 - 2 * 2e-40 = -2e-40.
    expect(() =>
      propagateUncertainty('a - b', { a: 1e-20, b: 1e-20 }, undefined, {
        covariance: [
          [1e-40, 2e-40],
          [2e-40, 1e-40],
        ],
      })
    ).toThrow(/negative variance/);
  });

  it('treats rounding of the quadratic form as zero variance', () => {
    // A singular but valid covariance: the exact variance is 0, the rounded one may be -1e-17.
    const result = propagateUncertainty('0.3 * a - b', { a: 1, b: 1 }, undefined, {
      covariance: [
        [1, 0.3],
        [0.3, 0.09],
      ],
    });
    expect(result.sigma).toBeLessThan(1e-6);
  });
});
