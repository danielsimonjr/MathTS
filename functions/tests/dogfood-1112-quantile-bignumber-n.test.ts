import { describe, it, expect } from 'vitest';
import { quantileSeq, bignumber, fraction, matrix } from '../src/factories/index.js';

const q = quantileSeq as (...a: unknown[]) => unknown;
// One argument per call: `bignumber` throws on extra arguments, as mathjs, so `.map(B)` fails.
const B = (x: unknown) => (bignumber as (x: unknown) => unknown)(x);
const num = (v: unknown): unknown => (Array.isArray(v) ? v.map(num) : Number(v));
const isBig = (v: unknown): boolean => !!v && (v as { isBigNumber?: boolean }).isBigNumber === true;

// Oracle: mathjs 15.2.0 and NumPy 2.3.5 np.quantile(x, [1/(N+1), ..., N/(N+1)]).
describe('quantileSeq with a BigNumber N (#1112)', () => {
  it('returns the N quantiles as BigNumbers, like the number form', () => {
    const r = q([1, 2, 3], B(3)) as unknown[];
    expect(Array.isArray(r)).toBe(true);
    expect(r.every(isBig)).toBe(true);
    expect(num(r)).toEqual([1.5, 2, 2.5]);
    expect(num(q([1, 2, 3, 4], B(3)))).toEqual([1.75, 2.5, 3.25]);
  });
  it('handles BigNumber data and Matrix data', () => {
    const big = q([1, 2, 3].map(B), B(3)) as unknown[];
    expect(big.every(isBig)).toBe(true);
    expect(num(big)).toEqual([1.5, 2, 2.5]);
    expect(num(q([1, 2, 3, 4, 5].map(B), B(4)))).toEqual([1.8, 2.6, 3.4, 4.2]);
    const mat = q(matrix([1, 2, 3]), B(3)) as unknown[];
    expect(mat.every(isBig)).toBe(true);
    expect(num(mat)).toEqual([1.5, 2, 2.5]);
  });
  it('handles sorted, method and options', () => {
    expect(num(q([1, 2, 3], B(3), true))).toEqual([1.5, 2, 2.5]);
    const lower = q([1, 2, 3], B(3), 'lower') as unknown[];
    expect(lower.every(isBig)).toBe(true);
    expect(num(lower)).toEqual([1, 2, 2]);
    expect(num(q([1, 2, 3], B(3), { method: 'higher' }))).toEqual([2, 2, 3]);
    expect(num(q([1, NaN, 3], B(3), { skipNaN: true }))).toEqual([1.5, 2, 2.5]);
    const nan = q([1, NaN, 3], B(3)) as unknown[];
    expect(nan.length).toBe(3);
    expect((num(nan) as number[]).every((x) => Number.isNaN(x))).toBe(true);
  });
  it('keeps the BigNumber probability and N=0, 1 behaviour', () => {
    expect(num(q([1, 2, 3, 4], B(0.25)))).toBe(1.75);
    expect(num(q([1, 2, 3], B(1)))).toBe(3);
    expect(num(q([1, 2, 3], B(0)))).toBe(1);
  });
  it('rejects bad N', () => {
    expect(() => q([1, 2, 3], B(-1))).toThrow(/non-negative/);
    expect(() => q([1, 2, 3], B(2.5))).toThrow(/positive integer/);
    expect(() => q([1, 2, 3], B(Infinity))).toThrow(/positive integer/);
  });
  // MathTS decision: a Fraction N returns the N quantiles as BigNumbers (mathjs 15.2.0 throws).
  it('gives a Fraction N the same quantiles (MathTS decision; mathjs throws)', () => {
    const r = q([1, 2, 3], (fraction as (x: unknown) => unknown)(3)) as unknown[];
    expect(r.every(isBig)).toBe(true);
    expect(num(r)).toEqual([1.5, 2, 2.5]);
  });
  it('is stable across repeated calls with mixed number and BigNumber data', () => {
    const run = (): string =>
      JSON.stringify(
        num([q([1, B(2), 3], 3), q([B(3), 1, 4, 2, B(5), 9, 0], 5), q([1, B(2), 3], B(3))])
      );
    const first = run();
    for (let i = 0; i < 50; i++) expect(run()).toBe(first);
  });
});
