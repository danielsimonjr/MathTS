/**
 * P7-11 pins: dense lsolve/usolve number path vs the generic loop, singular, BigNumber.
 */
import { describe, it, expect } from 'vitest';
import { bignumber, lsolve, lusolve, matrix, usolve } from '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { createLsolve } from '../src/algebra/solver/lsolve.js';
import { createUsolve } from '../src/algebra/solver/usolve.js';

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

/** Force the generic loop: typed.find throws on a plain-function divideScalar. */
function lsolveGeneric(L: unknown, b: unknown): unknown {
  const realDiv = factoryScope.divideScalar as (a: unknown, b: unknown) => unknown;
  const scope = new Proxy(factoryScope, {
    get: (target, key) =>
      key === 'divideScalar' ? (a: unknown, c: unknown) => realDiv(a, c) : target[key as string],
    has: (target, key) => key in target,
  });
  return (createLsolve(scope) as (a: unknown, bb: unknown) => unknown)(L, b);
}

function usolveGeneric(U: unknown, b: unknown): unknown {
  const realDiv = factoryScope.divideScalar as (a: unknown, b: unknown) => unknown;
  const scope = new Proxy(factoryScope, {
    get: (target, key) =>
      key === 'divideScalar' ? (a: unknown, c: unknown) => realDiv(a, c) : target[key as string],
    has: (target, key) => key in target,
  });
  return (createUsolve(scope) as (a: unknown, bb: unknown) => unknown)(U, b);
}

describe('P7-11 lsolve number path', () => {
  it('matches the generic loop on a 2×2 lower triangle', () => {
    const L = [
      [2, 0],
      [1, 4],
    ];
    const b = [2, 9];
    expectMatrixBitExact(asRows(lsolve(L, b)), asRows(lsolveGeneric(L, b)));
    expect(asRows(lsolve(L, b))).toEqual([[1], [2]]);
  });

  it('accepts a column-vector matrix right-hand side', () => {
    const L = [
      [1, 0],
      [0.5, 1],
    ];
    const x = asRows(lsolve(L, [[2], [3]]));
    expect(x).toEqual([[2], [2]]);
  });

  it('keeps DenseMatrix storage', () => {
    const L = matrix([
      [1, 0],
      [2, 1],
    ]) as { storage(): string };
    const out = lsolve(L, [1, 4]) as { storage(): string; toArray(): number[][] };
    expect(out.storage()).toBe(L.storage());
    expect(out.toArray()).toEqual([[1], [2]]);
  });

  it('throws the same singular error as the generic loop', () => {
    const L = [
      [1, 0],
      [0, 0],
    ];
    const b = [1, 1];
    expect(() => lsolve(L, b)).toThrow('Linear system cannot be solved since matrix is singular');
    expect(() => lsolveGeneric(L, b)).toThrow(
      'Linear system cannot be solved since matrix is singular'
    );
  });

  it('zero right-hand side on a zero diagonal stays degenerate (xj = 0)', () => {
    const L = [
      [1, 0],
      [0, 0],
    ];
    expect(asRows(lsolve(L, [1, 0]))).toEqual([[1], [0]]);
  });
});

describe('P7-11 usolve number path', () => {
  it('matches the generic loop on a 2×2 upper triangle', () => {
    const U = [
      [2, 1],
      [0, 4],
    ];
    const b = [4, 8];
    expectMatrixBitExact(asRows(usolve(U, b)), asRows(usolveGeneric(U, b)));
    expect(asRows(usolve(U, b))).toEqual([[1], [2]]);
  });

  it('throws the same singular error as the generic loop', () => {
    const U = [
      [0, 0],
      [0, 1],
    ];
    const b = [1, 1];
    expect(() => usolve(U, b)).toThrow('Linear system cannot be solved since matrix is singular');
    expect(() => usolveGeneric(U, b)).toThrow(
      'Linear system cannot be solved since matrix is singular'
    );
  });
});

describe('P7-11 lusolve after lup', () => {
  it('solves a 2×2 system', () => {
    const A = [
      [2, 1],
      [1, 4],
    ];
    const x = asRows(lusolve(A, [4, 9]));
    expect(x[0]![0]).toBe(1);
    expect(x[1]![0]).toBe(2);
  });
});

describe('P7-11 BigNumber fallback', () => {
  it('lsolve stays on the generic path', () => {
    const L = [
      [2, 0],
      [1, 4],
    ].map((row) => row.map((v) => bignumber(v)));
    const b = [2, 9].map((v) => bignumber(v));
    const x = asRows(lsolve(L, b));
    expect(cell(x[0]![0])).toBe(1);
    expect(cell(x[1]![0])).toBe(2);
  });

  it('usolve stays on the generic path', () => {
    const U = [
      [2, 1],
      [0, 4],
    ].map((row) => row.map((v) => bignumber(v)));
    const b = [4, 8].map((v) => bignumber(v));
    const x = asRows(usolve(U, b));
    expect(cell(x[0]![0])).toBe(1);
    expect(cell(x[1]![0])).toBe(2);
  });
});
