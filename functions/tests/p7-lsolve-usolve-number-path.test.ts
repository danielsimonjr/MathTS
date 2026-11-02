/**
 * P7-11 pins: dense lsolve/usolve number path vs the generic loop, singular,
 * near-singular, IEEE, mixed types, BigNumber/Fraction/Complex, and resume when
 * a found number signature leaves the number domain.
 */
import { describe, it, expect } from 'vitest';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';
import { bignumber, complex, lsolve, lusolve, matrix, usolve } from '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { createLsolve } from '../src/algebra/solver/lsolve.js';
import { createUsolve } from '../src/algebra/solver/usolve.js';
import type { TypedFunction } from '../src/core/function/typed.js';

function isComplexLike(v: unknown): v is { re: number; im: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    're' in v &&
    'im' in v &&
    typeof (v as { re: unknown }).re === 'number' &&
    typeof (v as { im: unknown }).im === 'number'
  );
}

function cell(v: unknown): unknown {
  if (typeof v === 'number') return v;
  if (isComplexLike(v)) return { re: v.re, im: v.im };
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
      const a = cell(actual[i]![j]);
      const e = cell(expected[i]![j]);
      if (isComplexLike(a) && isComplexLike(e)) {
        expect(Object.is(a.re, e.re)).toBe(true);
        expect(Object.is(a.im, e.im)).toBe(true);
      } else {
        expect(Object.is(a, e)).toBe(true);
      }
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

describe('P7-11 BigNumber / Fraction / Complex fallback', () => {
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

  it('a Fraction entry stays on the generic path and matches it', () => {
    const L = [
      [new Fraction(2, 1), 0],
      [new Fraction(1, 1), new Fraction(4, 1)],
    ];
    const b = [new Fraction(2, 1), new Fraction(9, 1)];
    expectMatrixBitExact(asRows(lsolve(L, b)), asRows(lsolveGeneric(L, b)));
  });

  it('a Complex entry stays on the generic path and matches it', () => {
    const L = [
      [complex(2, 0), 0],
      [complex(1, 0), complex(4, 0)],
    ];
    const b = [complex(2, 0), complex(9, 0)];
    expectMatrixBitExact(asRows(lsolve(L, b)), asRows(lsolveGeneric(L, b)));
  });

  it('one Complex among numbers keeps the whole system on the generic path', () => {
    const L = [
      [2, 0],
      [new Complex(1, 0), 4],
    ];
    const b = [-2, 7];
    expectMatrixBitExact(asRows(lsolve(L, b)), asRows(lsolveGeneric(L, b)));
  });
});

describe('P7-11 near-singular, IEEE, and matrix RHS', () => {
  it('a diagonal inside absTol throws the same singular error as the generic loop', () => {
    const L = [
      [1e-16, 0],
      [1, 1e-16],
    ];
    const b = [1e-16, 2];
    expect(() => lsolve(L, b)).toThrow('Linear system cannot be solved since matrix is singular');
    expect(() => lsolveGeneric(L, b)).toThrow(
      'Linear system cannot be solved since matrix is singular'
    );
  });

  it('a diagonal just above absTol stays bit-exact against the generic loop', () => {
    const L = [
      [1e-14, 0],
      [1, 1e-14],
    ];
    const b = [1e-14, 2];
    expectMatrixBitExact(asRows(lsolve(L, b)), asRows(lsolveGeneric(L, b)));
  });

  it('NaN, -0 and Infinity stay bit-exact on lsolve and usolve', () => {
    const L = [
      [NaN, 0],
      [-0, Infinity],
    ];
    const b = [1, 1];
    expectMatrixBitExact(asRows(lsolve(L, b)), asRows(lsolveGeneric(L, b)));
    const U = [
      [Infinity, -0],
      [0, NaN],
    ];
    expectMatrixBitExact(asRows(usolve(U, b)), asRows(usolveGeneric(U, b)));
  });

  it('n×1 DenseMatrix rhs matches the generic loop', () => {
    const L = [
      [2, 0],
      [1, 4],
    ];
    const b = matrix([[2], [9]]);
    expectMatrixBitExact(asRows(lsolve(L, b)), asRows(lsolveGeneric(L, b)));
  });
});

describe('P7-11 resume when a number signature leaves the number domain', () => {
  /**
   * A found `number, number` divideScalar can return Complex(a/b, 0). The number
   * path must resume the generic loop from that column; otherwise cached number
   * multiplication coerces the Complex to its magnitude and loses the sign.
   */
  function withComplexNumberDiv<T>(create: (scope: typeof factoryScope) => T, plain: boolean): T {
    const typed = factoryScope.typed as TypedFunction;
    const realDiv = factoryScope.divideScalar as (a: unknown, b: unknown) => unknown;
    const divideScalar = plain
      ? (a: unknown, b: unknown) =>
          typeof a === 'number' && typeof b === 'number' ? new Complex(a / b, 0) : realDiv(a, b)
      : typed('divideScalar', {
          'number, number': (a: number, b: number) => new Complex(a / b, 0),
          'any, any': (a: unknown, b: unknown) => realDiv(a, b),
        });
    const scope = new Proxy(factoryScope, {
      get: (target, key) => (key === 'divideScalar' ? divideScalar : target[key as string]),
      has: (target, key) => key in target,
    });
    return create(scope);
  }

  it('lsolve matches the generic loop when divideScalar returns Complex', () => {
    const L = [
      [2, 0],
      [1, 4],
    ];
    const b = [-2, 7];
    const fast = withComplexNumberDiv(createLsolve, false) as (a: unknown, bb: unknown) => unknown;
    const generic = withComplexNumberDiv(createLsolve, true) as (
      a: unknown,
      bb: unknown
    ) => unknown;
    expectMatrixBitExact(asRows(fast(L, b)), asRows(generic(L, b)));
    const x = asRows(fast(L, b));
    expect((x[0]![0] as Complex).re).toBe(-1);
    expect((x[1]![0] as Complex).re).toBe(2);
  });

  it('usolve matches the generic loop when divideScalar returns Complex', () => {
    const U = [
      [2, 1],
      [0, 4],
    ];
    const b = [0, -4];
    const fast = withComplexNumberDiv(createUsolve, false) as (a: unknown, bb: unknown) => unknown;
    const generic = withComplexNumberDiv(createUsolve, true) as (
      a: unknown,
      bb: unknown
    ) => unknown;
    expectMatrixBitExact(asRows(fast(U, b)), asRows(generic(U, b)));
    const x = asRows(fast(U, b));
    expect((x[0]![0] as Complex).re).toBe(0.5);
    expect((x[1]![0] as Complex).re).toBe(-1);
  });
});
