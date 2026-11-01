/**
 * P7-4 pins: dense LUP number path vs the generic loop, fallbacks, and replaced deps.
 */
import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { bignumber, lup, lusolve, matrix } from '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { createLup } from '../src/algebra/decomposition/lup.js';

type LupOut = { L: unknown; U: unknown; p: number[] };

function cell(v: unknown): unknown {
  if (typeof v === 'number') return v;
  if (
    v &&
    typeof v === 'object' &&
    'toNumber' in v &&
    typeof (v as { toNumber: unknown }).toNumber === 'function'
  ) {
    return (v as { toNumber(): number }).toNumber();
  }
  if (v && typeof v === 'object' && 'valueOf' in v) return (v as { valueOf(): unknown }).valueOf();
  return v;
}

function asRows(x: unknown): unknown[][] {
  if (Array.isArray(x)) return x as unknown[][];
  if (x && typeof x === 'object' && 'valueOf' in x)
    return (x as { valueOf(): unknown[][] }).valueOf();
  throw new Error('not a matrix');
}

function expectMatrixBitExact(actual: unknown[][], expected: unknown[][]): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i]!.length).toBe(expected[i]!.length);
    for (let j = 0; j < actual[i]!.length; j++) {
      expect(Object.is(cell(actual[i]![j]), cell(expected[i]![j]))).toBe(true);
    }
  }
}

function expectLupBitExact(a: LupOut, b: LupOut): void {
  expectMatrixBitExact(asRows(a.L), asRows(b.L));
  expectMatrixBitExact(asRows(a.U), asRows(b.U));
  expect(a.p).toEqual(b.p);
}

/** Force the generic loop: typed.find throws on a plain-function addScalar. */
function lupGeneric(A: unknown): LupOut {
  const realAdd = factoryScope.addScalar as (a: unknown, b: unknown) => unknown;
  const scope = new Proxy(factoryScope, {
    get: (target, key) =>
      key === 'addScalar' ? (a: unknown, b: unknown) => realAdd(a, b) : target[key as string],
    has: (target, key) => key in target,
  });
  return (createLup(scope) as (a: unknown) => LupOut)(A);
}

function seededMatrix(rows: number, cols: number, seed: number): number[][] {
  let s = seed >>> 0;
  const A: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      row.push((s / 0xffffffff) * 2 - 1);
    }
    A.push(row);
  }
  return A;
}

describe('P7-4 lup number path — matches the generic loop', () => {
  it('2×2 textbook example', () => {
    const A = [
      [2, 1],
      [1, 4],
    ];
    const { L, U, p } = lup(A) as LupOut;
    expectMatrixBitExact(asRows(L), [
      [1, 0],
      [0.5, 1],
    ]);
    expectMatrixBitExact(asRows(U), [
      [2, 1],
      [0, 3.5],
    ]);
    expect(p).toEqual([0, 1]);
    expectLupBitExact(lup(A) as LupOut, lupGeneric(A));
  });

  it.each([
    ['8×8', 8, 8, 0x740808],
    ['60×20', 60, 20, 0x746020],
    ['20×60', 20, 60, 0x742060],
    ['32×32 DenseMatrix', 32, 32, 0x743232],
  ])('%s is bit-exact against the generic loop', (name, rows, cols, seed) => {
    const A = seededMatrix(rows, cols, seed);
    const input = name.includes('DenseMatrix') ? matrix(A) : A;
    expectLupBitExact(lup(input) as LupOut, lupGeneric(input));
  });

  it('row swaps at every step stay bit-exact', () => {
    const A = [
      [0.01, 2, 3],
      [4, 0.02, 5],
      [6, 7, 0.03],
    ];
    expectLupBitExact(lup(A) as LupOut, lupGeneric(A));
    expect((lup(A) as LupOut).p).not.toEqual([0, 1, 2]);
  });

  it('pivots within relTol stay bit-exact', () => {
    const A = [
      [1, 2],
      [1 + 1e-16, 3],
    ];
    expectLupBitExact(lup(A) as LupOut, lupGeneric(A));
  });

  it('singular 24×24 stays bit-exact', () => {
    const A = seededMatrix(24, 24, 0x742424);
    for (let i = 0; i < 24; i++) A[i]![23] = A[i]![0]!;
    expectLupBitExact(lup(A) as LupOut, lupGeneric(A));
  });

  it('NaN, -0 and Infinity stay bit-exact', () => {
    const A = [
      [NaN, 1],
      [-0, Infinity],
    ];
    expectLupBitExact(lup(A) as LupOut, lupGeneric(A));
  });
});

describe('P7-4 lup number path — fallbacks', () => {
  it('BigNumber 8×8 stays on the generic path and matches itself', () => {
    const A = seededMatrix(8, 8, 0x74b808).map((row) => row.map((x) => bignumber(x)));
    const r1 = lup(A) as LupOut;
    const r2 = lup(A.map((row) => row.slice())) as LupOut;
    expectLupBitExact(r1, r2);
  });

  it('a Fraction entry stays on the generic path', () => {
    const A = [
      [new Fraction(1, 2), 1],
      [2, 3],
    ];
    expectLupBitExact(lup(A) as LupOut, lupGeneric(A));
  });
});

describe('P7-4 lup number path — lusolve', () => {
  it('vector rhs', () => {
    const A = [
      [3, 1],
      [1, 2],
    ];
    const x = lusolve(A, [9, 8]) as unknown[][];
    expect(cell(asRows(x)[0]![0])).toBeCloseTo(2, 12);
    expect(cell(asRows(x)[1]![0])).toBeCloseTo(3, 12);
  });

  it('n×1 matrix rhs', () => {
    const A = [
      [3, 1],
      [1, 2],
    ];
    const x = asRows(lusolve(A, [[9], [8]]));
    expect(cell(x[0]![0])).toBeCloseTo(2, 12);
    expect(cell(x[1]![0])).toBeCloseTo(3, 12);
  });
});

describe('P7-4 lup number path — replaced dependencies', () => {
  it('a plain-function addScalar keeps lup working on the generic path', () => {
    const A = [
      [2, 1],
      [1, 4],
    ];
    const r = lupGeneric(A);
    expectMatrixBitExact(asRows(r.L), [
      [1, 0],
      [0.5, 1],
    ]);
    expectMatrixBitExact(asRows(r.U), [
      [2, 1],
      [0, 3.5],
    ]);
    expect(r.p).toEqual([0, 1]);
  });
});
