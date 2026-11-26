/**
 * mathjs parity: std/variance default to 'unbiased' (sample, ÷(N-1)) and accept a
 * normalization argument. Regression for the compat stats-default gap.
 *
 * Since #1280, compat `std` and `variance` are the functions-package implementations (one
 * implementation, not a copy): they honour the dimension argument, the variadic form and
 * BigNumber data, and they rescale data whose squared deviations leave the range. Each result
 * that changed is pinned here against mathjs 15.2.0.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { create, all } from '../src/index.js';

const math = create(all);

describe('compat std/variance — mathjs defaults', () => {
  it('std defaults to sample (unbiased)', () => {
    expect(math.std([2, 4, 6])).toBeCloseTo(2.0, 10);
  });

  it('variance defaults to sample (unbiased)', () => {
    expect(math.variance([2, 4, 6])).toBeCloseTo(4.0, 10);
  });

  it('accepts uncorrected (population) normalization', () => {
    expect(math.variance([2, 4, 6], 'uncorrected')).toBeCloseTo(2.6666666666666665, 10);
    expect(math.std([2, 4, 6], 'uncorrected')).toBeCloseTo(1.632993161855452, 10);
  });

  it('accepts biased normalization (÷(N+1))', () => {
    expect(math.variance([2, 4, 6], 'biased')).toBeCloseTo(8 / 4, 10);
  });

  it('single-element variance is 0 (no divide-by-zero)', () => {
    expect(math.variance([5])).toBe(0);
  });

  it('mean/sum/min/max remain unaffected', () => {
    expect(math.mean([1, 2, 3, 4])).toBe(2.5);
    expect(math.sum([1, 2, 3])).toBe(6);
    expect(math.min([3, 1, 2])).toBe(1);
    expect(math.max([3, 1, 2])).toBe(3);
  });
});

describe('#1280 compat std and variance are the functions implementations', () => {
  const EPS4 = 4 * Number.EPSILON;
  const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));
  // The public overloads of std and variance do not name a compat matrix or a BigNumber matrix, but
  // the functions implementation accepts both, as mathjs does. The calls below go through these two
  // loosely typed handles; the public types are not weakened.
  const stdOf = math.std as unknown as (...a: unknown[]) => unknown;
  const varianceOf = math.variance as unknown as (...a: unknown[]) => unknown;
  // The same for `matrix` (typed for number data; the runtime builds a matrix of BigNumber or
  // Fraction entries), `mean` and `median`, and for the mathjs calls with a numeric string.
  const matrixOf = math.matrix as unknown as (data: unknown[]) => unknown;
  const meanOf = math.mean as unknown as (...a: unknown[]) => unknown;
  const medianOf = math.median as unknown as (...a: unknown[]) => unknown;
  const mathjsStd = mathjs.std as unknown as (...a: unknown[]) => unknown;
  const mathjsMatrix = mathjs.matrix as unknown as (data: unknown[]) => unknown;
  const mathjsVariance = mathjs.variance as unknown as (...a: unknown[]) => unknown;
  // mathjs 15.2.0 has the #1280 error for these two lists, so they pin the closed form.
  it('std of data with subnormal squared deviations (0 for 1e-170 before)', () => {
    expect(rel(math.std([1e-160, 3e-160]) as number, Math.SQRT2 * 1e-160)).toBeLessThan(EPS4);
    expect(rel(math.std([1e-170, 3e-170]) as number, Math.SQRT2 * 1e-170)).toBeLessThan(EPS4);
  });
  it('honours the dimension argument (1.707825127659933 before)', () => {
    const m = [
      [1, 2],
      [3, 5],
    ];
    const ref = mathjs.std(mathjs.matrix(m), 1) as unknown as { toArray(): number[] };
    const dense = stdOf(math.matrix(m), 1) as { toArray(): number[] };
    expect(dense.toArray()).toEqual(ref.toArray());
    const sparse = stdOf(math.sparse(m), 1) as { toArray(): number[]; storage(): string };
    const sparseRef = mathjs.std(mathjs.sparse(m), 1) as unknown as { toArray(): number[][] };
    expect(sparse.toArray()).toEqual(sparseRef.toArray());
    expect(sparse.storage()).toBe('sparse');
    // #1550/#1587: variance(A, dim) is a Matrix, as in mathjs (the compat fold
    // used to return the bare Array).
    const varianceRef = mathjsVariance(mathjsMatrix(m), 0) as unknown as { toArray(): number[] };
    expect((varianceOf(math.matrix(m), 0) as { toArray(): number[] }).toArray()).toEqual(
      varianceRef.toArray()
    );
  });
  it('the variadic form std(1, 2, 4) (0 before)', () => {
    expect(rel(stdOf(1, 2, 4) as number, mathjs.std(1, 2, 4))).toBeLessThan(EPS4);
  });
  it('a BigNumber matrix gives a BigNumber (a number before)', () => {
    const v = varianceOf(matrixOf([math.bignumber(1), math.bignumber(2)]));
    expect(math.isBigNumber(v)).toBe(true);
    expect(String(v)).toBe('0.5');
    const ref = mathjsVariance(mathjsMatrix([mathjs.bignumber(1), mathjs.bignumber(2)]));
    expect(String(ref)).toBe('0.5');
  });
  it('numeric strings (6.519202405202649 before)', () => {
    expect(stdOf(['1', '3'])).toBe(mathjsStd(['1', '3']));
  });
  it('an unknown normalization throws (a number before)', () => {
    expect(() => stdOf([1, 2, 4], 'bogus')).toThrow();
    expect(() => mathjs.std([1, 2, 4], 'bogus' as never)).toThrow();
  });
  it('mean of a BigNumber matrix is a BigNumber (the #964 item 4 regression)', () => {
    const v = meanOf(matrixOf([math.bignumber(1), math.bignumber(2)]));
    expect(math.isBigNumber(v)).toBe(true);
    expect(String(v)).toBe('1.5');
  });
  it('median of a Fraction matrix is a Fraction (the #964 item 3 regression)', () => {
    const v = medianOf(matrixOf([math.fraction(1, 2), math.fraction(5, 2), math.fraction(3, 2)]));
    expect(math.isFraction(v)).toBe(true);
    expect(String(v)).toBe('1.5');
  });
  it('unchanged: variance([5]) is 0', () => {
    expect(math.variance([5])).toBe(0);
  });
});
