/**
 * Integration smoke for #1785 adapter wiring on `create(all)` (coverage + regression).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../../src/index.js';

describe('matrix #1785 integration wiring', () => {
  const math = create(all);

  it('exercises map, sum, max/min, concat, range, and matrix builders', () => {
    expect(math.map([[3], []], math.square)).toEqual([[9], []]);
    expect(math.sum([])).toBe(0);
    expect(math.max(1n, 2)).toBe(2);
    expect(math.min(1n, 3, '1')).toBe(1n);
    const stacked = math.concat(math.matrix([1]), math.matrix([2]), math.bignumber(0)) as {
      size(): { valueOf(): number[] };
    };
    expect(stacked.size().valueOf()).toEqual([2]);
    const cols = math.matrixFromColumns([[1], [2]]) as unknown;
    expect(Array.isArray(cols) || math.isMatrix(cols)).toBe(true);
    const legacy = create(all, { legacySubset: true });
    const scalarGet = legacy
      .matrix([[5]])
      .subset(legacy.index(0, 0)) as unknown;
    expect(typeof scalarGet === 'number' || legacy.isBigNumber(scalarGet)).toBe(true);
    const shaped = math.reshape(math.matrix([1, 2, 3, 4]), [2, 2]) as { type?: string };
    expect(shaped.type).toBe('DenseMatrix');
    const frac = create(all, { number: 'Fraction' });
    const fracRange = frac.range(frac.fraction(0), frac.fraction(2), frac.fraction(1));
    expect(frac.isMatrix(fracRange) || Array.isArray(fracRange)).toBe(true);
  });

  it('exercises BigNumber empty-sum, guarded range, and fraction compare paths', () => {
    const bn = create(all, { number: 'BigNumber' });
    expect(bn.isBigNumber(bn.sum([]))).toBe(true);
    expect(() => bn.range(0, 1, bn.bignumber(0))).toThrow(/non-zero/);
    const mad = math.mad([math.fraction(1, 2), math.fraction(1, 4), math.fraction(1, 8)]);
    expect(typeof mad === 'number' || math.isBigNumber(mad) || math.isFraction(mad)).toBe(true);
    const rot = math.matrix([
      [Math.cos(0.1), -Math.sin(0.1)],
      [Math.sin(0.1), Math.cos(0.1)],
    ]);
    math.round(rot, 2);
    expect(math.ctranspose(rot).type).toBe('DenseMatrix');
  });
});