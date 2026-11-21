import { describe, it, expect } from 'vitest';
// Issues #977 and #1003 (code review F3, F4; lead ruling L3). `linsolve` and `lstsq` read `b`
// with one reader (`readRightHandSide` of the matrix package). The kind (vector or matrix)
// comes from the structure, never from the type of entry 0, and an entry converts to a number
// as in mathjs 15.2.0 `lusolve`: a numeric string, a boolean, a BigNumber, a Fraction and null
// convert; a non-numeric string throws `Cannot convert`; an array inside a vector throws.
// Before: `lstsq(A, matrix([bignumber(5), bignumber(11)]))` returned [[0],[0]], and `linsolve`
// read `[5, [11]]` and `['a', '11']` with no check.
import { lstsq } from '@danielsimonjr/mathts-matrix';
import { bignumber, fraction, linsolve, matrix } from '../src/index.js';

const A = [
  [1, 2],
  [3, 4],
];
const D = [
  [2, 0],
  [0, 2],
];
const bad = (x: unknown): never => x as never;

/** The solution as a flat vector: a column result `[[1], [2]]` reads as `[1, 2]`. */
function flat(actual: unknown): number[] {
  return (actual as unknown[]).map((v) => (Array.isArray(v) ? (v[0] as number) : (v as number)));
}

function expectSolution(actual: unknown, expected: number[]): void {
  const x = flat(actual);
  expect(x.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(x[i] - expected[i])).toBeLessThan(1e-12);
  }
}

const solvers = [
  ['linsolve', (M: number[][], b: unknown): unknown => linsolve(M, bad(b))],
  ['lstsq', (M: number[][], b: unknown): unknown => lstsq(M, bad(b))],
] as const;

describe('issue #977/#1003: one right-hand-side reader for linsolve and lstsq', () => {
  for (const [name, solve] of solvers) {
    it(`${name}: BigNumber and string entries convert (vector, column, MathJS matrix)`, () => {
      expectSolution(solve(A, [bignumber(5), bignumber(11)]), [1, 2]);
      expectSolution(solve(A, [[bignumber(5)], [bignumber(11)]]), [1, 2]);
      expectSolution(solve(A, matrix([bignumber(5), bignumber(11)])), [1, 2]);
      expectSolution(solve(A, ['5', '11']), [1, 2]);
      expectSolution(solve(A, [['5'], ['11']]), [1, 2]);
    });

    it(`${name}: a Fraction, a boolean and null convert, as in mathjs lusolve`, () => {
      expectSolution(solve(D, [fraction(1, 2), 1]), [0.25, 0.5]);
      expectSolution(solve(D, [true, false]), [0.5, 0]);
      expectSolution(solve(D, [null, 1]), [0, 0.5]);
    });

    it(`${name}: a non-numeric string and a mixed vector throw, as in mathjs`, () => {
      expect(() => solve(A, ['a', '11'])).toThrow(/Cannot convert "a" to a number/);
      expect(() => solve(A, [5, [11]])).toThrow(/b\[1\] is a Array/);
      expect(() => solve(A, [[5], 11])).toThrow(/rectangular/);
    });
  }

  it('linsolve: a MathJS A with a BigNumber entry names the entry type, with no word "square"', () => {
    const big = matrix([
      [bignumber(1), bignumber(2)],
      [bignumber(3), bignumber(4)],
    ]);
    let message = '';
    try {
      linsolve(bad(big), [5, 11]);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/row 0 column 0 is BigNumber/);
    expect(message).not.toMatch(/square/);
  });
});
