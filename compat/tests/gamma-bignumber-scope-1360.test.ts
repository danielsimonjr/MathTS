/**
 * #1360 - `gammaDist(2, 2)` failed in a compat scope with `number: 'BigNumber'`.
 *
 * The scope passes the rate as a BigNumber, which is an object, so `gammaDist` read it as an
 * options object and threw. A BigNumber or a Fraction rate is now a rate, and the constructor
 * stores the parameters as numbers (#1384).
 */
import { describe, expect, it } from 'vitest';
import { create, all } from '../src/index.js';

describe('#1360 gammaDist in a BigNumber scope', () => {
  const math = create(all, { number: 'BigNumber' }) as unknown as {
    evaluate(expr: string): { mean: number; variance: number };
  };
  it('gammaDist(2, 2) is the rate distribution (it threw before)', () => {
    expect(math.evaluate('gammaDist(2, 2)')).toMatchObject({ mean: 1, variance: 0.5 });
  });
  it('GUARD: the scale form and another constructor keep their results', () => {
    expect(math.evaluate('gammaDist(2, {scale: 2})')).toMatchObject({ mean: 4 });
    expect(math.evaluate('normalDist(1, 2)')).toMatchObject({ mean: 1, variance: 4 });
  });
});
