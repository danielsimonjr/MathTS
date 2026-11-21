import { describe, it, expect } from 'vitest';
// Issues #977 and #1003 (code review F3, F4; lead ruling L3). `linsolve` and `lstsq` read `b`
// with one reader (`readRightHandSide` of the matrix package). The kind (vector or matrix)
// comes from the structure, never from the type of entry 0. The entry rule is the implicit
// to-number rule of mathjs 15.2.0: a number stays, a numeric string, a boolean and a bigint
// convert, null and undefined are 0, a non-numeric string throws `Cannot convert`. A BigNumber,
// Fraction or Complex entry keeps its type: `linsolve` then solves with the typed `lusolve`, as
// mathjs `lusolve` does, and `lstsq` (a floating-point solver; mathjs has no `lstsq`) refuses it.
// Before: `lstsq(A, matrix([bignumber(5), bignumber(11)]))` returned [[0],[0]], and `linsolve`
// read `[5, [11]]` and `['a', '11']` with no check and a Complex entry as its absolute value.
import { lstsq } from '@danielsimonjr/mathts-matrix';
import { bignumber, complex, fraction, linsolve, matrix, typeOf } from '../src/index.js';

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
function flat(actual: unknown): unknown[] {
  return (actual as unknown[]).map((v) => (Array.isArray(v) ? (v[0] as unknown) : v));
}

function expectSolution(actual: unknown, expected: number[]): void {
  const x = flat(actual) as number[];
  expect(x.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(typeof x[i]).toBe('number');
    expect(Math.abs(x[i] - expected[i])).toBeLessThan(1e-12);
  }
}

/** Entries of a typed solution as `[type, value text]` pairs. */
function typed(actual: unknown): [string, string][] {
  return flat(actual).map((v) => [String(typeOf(v)), String(v)]);
}

const solvers = [
  ['linsolve', (M: unknown[][], b: unknown): unknown => linsolve(bad(M), bad(b))],
  ['lstsq', (M: unknown[][], b: unknown): unknown => lstsq(bad(M), bad(b))],
] as const;

describe('issue #977/#1003: one entry rule for linsolve and lstsq (the mathjs implicit rule)', () => {
  for (const [name, solve] of solvers) {
    it(`${name}: numeric strings convert in b and in A`, () => {
      expectSolution(solve(A, ['5', '11']), [1, 2]);
      expectSolution(solve(A, [['5'], ['11']]), [1, 2]);
      expectSolution(
        solve(
          [
            ['1', '2'],
            ['3', '4'],
          ],
          [5, 11]
        ),
        [1, 2]
      );
    });

    it(`${name}: a boolean, null and undefined convert, as in mathjs lusolve`, () => {
      expectSolution(solve(D, [true, false]), [0.5, 0]);
      expectSolution(solve(D, [null, 1]), [0, 0.5]);
      expectSolution(solve(D, [undefined, 1]), [0, 0.5]);
    });

    it(`${name}: a non-numeric string and a mixed vector throw, as in mathjs`, () => {
      expect(() => solve(A, ['a', '11'])).toThrow(/Cannot convert "a" to a number/);
      expect(() =>
        solve(
          [
            ['a', '2'],
            ['3', '4'],
          ],
          [5, 11]
        )
      ).toThrow(/Cannot convert "a" to a number/);
      expect(() => solve(A, [5, [11]])).toThrow(/b\[1\] is a Array/);
      expect(() => solve(A, [[5], 11])).toThrow(/rectangular/);
    });
  }

  it('linsolve: a Complex b gives the complex solution of mathjs lusolve', () => {
    const x = flat(linsolve(A, bad([complex(5, 1), 11]))) as { re: number; im: number }[];
    expect(x.map((v) => typeOf(v))).toEqual(['Complex', 'Complex']);
    // mathjs 15.2.0: [[1 - 2i], [2 + 1.5i]] (to rounding)
    expect(Math.abs(x[0].re - 1) + Math.abs(x[0].im + 2)).toBeLessThan(1e-12);
    expect(Math.abs(x[1].re - 2) + Math.abs(x[1].im - 1.5)).toBeLessThan(1e-12);
    expect(typed(linsolve(D, bad([complex(2, 2), 4])))).toEqual([
      ['Complex', '1 + i'],
      ['Complex', '2'],
    ]);
  });

  it('linsolve: a BigNumber or Fraction b keeps its type, as in mathjs lusolve', () => {
    expect(typed(linsolve(D, bad([bignumber(2), bignumber(4)])))).toEqual([
      ['BigNumber', '1'],
      ['BigNumber', '2'],
    ]);
    expect(typed(linsolve(D, bad(matrix([bignumber(2), bignumber(4)]))))).toEqual([
      ['BigNumber', '1'],
      ['BigNumber', '2'],
    ]);
    expect(typed(linsolve(D, bad([fraction(1, 2), 1])))).toEqual([
      ['Fraction', '0.25'],
      ['Fraction', '0.5'],
    ]);
  });

  it('linsolve: a MathJS A of BigNumbers gives BigNumbers, as mathjs lusolve(bignumber(A), b)', () => {
    const big = matrix([
      [bignumber(1), bignumber(2)],
      [bignumber(3), bignumber(4)],
    ]);
    expect(typed(linsolve(bad(big), [5, 11]))).toEqual([
      ['BigNumber', '1'],
      ['BigNumber', '2'],
    ]);
  });

  it('lstsq: a BigNumber, Fraction or Complex entry throws a TypeError that names the type', () => {
    expect(() => lstsq(A, bad([bignumber(5), bignumber(11)]))).toThrow(/BigNumber/);
    expect(() => lstsq(A, bad([fraction(5), 11]))).toThrow(/Fraction/);
    expect(() => lstsq(A, bad([complex(5, 1), 11]))).toThrow(/Complex/);
    expect(() => lstsq(A, bad([bignumber(5), bignumber(11)]))).toThrow(TypeError);
  });
});
