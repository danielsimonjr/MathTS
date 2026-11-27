/**
 * Broad create(all) smoke to exercise index.ts matrix / numeric wiring (#1785).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../../src/index.js';

describe('index matrix and numeric wiring breadth (#1785)', () => {
  it('exercises matrix helpers, statistics, and expression evaluate', () => {
    const math = create(all);
    const bn = create(all, { number: 'BigNumber' });
    const frac = create(all, { number: 'Fraction' });
    expect(math.matrixFromColumns([[1], [2]])).toBeDefined();
    expect(math.matrixFromRows([[1, 2]])).toBeDefined();
    expect(math.matrixFromFunction([2, 2], () => 1)).toBeDefined();
    expect(math.concat(math.matrix([1]), math.matrix([2]))).toBeDefined();
    expect(math.sum(math.matrix([1, 2, 3]))).toBe(6);
    expect(math.mad([frac.fraction(1, 2), frac.fraction(1, 4)])).toBeDefined();
    expect(math.std([1, 2, 3])).toBeDefined();
    expect(math.variance([1, 2, 3])).toBeDefined();
    expect(bn.range(bn.bignumber(0), bn.bignumber(2), bn.bignumber(1), true)).toBeDefined();
    expect(math.evaluate('matrix([1,2,3])')).toBeDefined();
    expect(math.evaluate('ones(2)')).toBeDefined();
    expect(math.expm(math.matrix([[0, 0], [0, 0]]))).toBeDefined();
    expect(math.ctranspose(math.matrix([[1, 2], [3, 4]]))).toBeDefined();
    expect(math.resize(math.matrix([1, 2, 3]), [3, 1])).toBeDefined();
    const imm = math.matrix(new math.ImmutableDenseMatrix([1, 2, 3]));
    expect((imm as { type?: string }).type).toBe('ImmutableDenseMatrix');
  });
});