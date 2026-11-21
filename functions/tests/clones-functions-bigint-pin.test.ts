/**
 * Oracle pins for clone batch PR 2 (M3 BigNumber combinations, M8 schoolbook mul, M16 binomialExact).
 */
import { describe, it, expect } from 'vitest';
import { factoryScope } from '../src/factories/scope.js';
import { mul } from '../src/typed/factorization/integer-poly.js';
import { mulP } from '../src/typed/factorization/finite-field.js';
import type { IntPoly } from '../src/typed/factorization/integer-poly.js';
import * as functionsApi from '../src/index.js';
import { eulerNumbers } from '../src/index.js';
import { chooseScalar } from '../src/wasm/special/scalars.js';
import { BigNumber } from '@danielsimonjr/mathts-core';
const P = (...c: number[]): IntPoly => c.map(BigInt);

/** Independent exact binomial via bigint (oracle for rounded float path). */
function binomialBigInt(n: bigint, k: bigint): bigint {
  if (k < 0n || k > n) return 0n;
  const kk = k < n - k ? k : n - k;
  let r = 1n;
  for (let i = 0n; i < kk; i += 1n) {
    r = (r * (n - i)) / (i + 1n);
  }
  return r;
}

describe('combinations factory number path (unchanged)', () => {
  it('C(7, 5) = 21', () => {
    expect((factoryScope.combinations as (n: number, k: number) => number)(7, 5)).toBe(21);
  });
});

describe('helpers stay off the package barrel', () => {
  it('does not export binomialProductBigNumber, schoolbookMul, isPositiveInteger, chooseScalar', () => {
    expect('binomialProductBigNumber' in functionsApi).toBe(false);
    expect('schoolbookMul' in functionsApi).toBe(false);
    expect('isPositiveInteger' in functionsApi).toBe(false);
    expect('chooseScalar' in functionsApi).toBe(false);
  });
});

/** The typed `combinations` on core BigNumbers (the factory of the same name is gone, #1093). */
const combinationsBn = (n: BigNumber, k: BigNumber): BigNumber =>
  (functionsApi.combinations as (a: unknown, b: unknown) => BigNumber)(n, k);
const bn = (value: string | number): BigNumber => BigNumber.parse(String(value));

/** The typed `combinationsWithRep` on core BigNumbers (the factory of the same name is gone, #1093). */
const combinationsWithRepBn = (n: BigNumber, k: BigNumber): BigNumber =>
  (functionsApi.combinationsWithRep as (a: unknown, b: unknown) => BigNumber)(n, k);

describe('combinations and combinationsWithRep (typed) BigNumber paths', () => {
  it('C(7, 5) = 21 through the typed combinations', () => {
    expect(combinationsBn(bn(7), bn(5)).toString()).toBe('21');
  });

  it('throws the combinations error strings', () => {
    expect(() => combinationsBn(bn(-1), bn(0))).toThrow(TypeError);
    expect(() => combinationsBn(bn(-1), bn(0))).toThrow(
      'Positive integer value expected in function combinations'
    );
    expect(() => combinationsBn(bn('2.5'), bn(1))).toThrow(
      'Positive integer value expected in function combinations'
    );
    expect(() => combinationsBn(bn(3), bn(4))).toThrow(
      'k must be less than n in function combinations'
    );
  });

  it('with-rep C(n+k-1, k) for (1,0), (5,0), (5,1), (3,3), (7,3)', () => {
    expect(combinationsWithRepBn(bn(1), bn(0)).toString()).toBe('1');
    expect(combinationsWithRepBn(bn(5), bn(0)).toString()).toBe('1');
    expect(combinationsWithRepBn(bn(5), bn(1)).toString()).toBe('5');
    expect(combinationsWithRepBn(bn(3), bn(3)).toString()).toBe('10');
    expect(combinationsWithRepBn(bn(5), bn(3)).toString()).toBe('35');
  });

  it('with-rep C(60, 30) is above 2^53 and exact', () => {
    // n = 31, k = 30: C(31 + 30 - 1, 30) = C(60, 30)
    expect(combinationsWithRepBn(bn(31), bn(30)).toString()).toBe('118264581564861424');
  });

  it('throws the combinationsWithRep error strings', () => {
    expect(() => combinationsWithRepBn(bn(-1), bn(1))).toThrow(TypeError);
    expect(() => combinationsWithRepBn(bn(-1), bn(1))).toThrow(
      'Positive integer value expected in function combinationsWithRep'
    );
    expect(() => combinationsWithRepBn(bn(0), bn(1))).toThrow(
      'k must be less than or equal to n + k - 1 in function combinationsWithRep'
    );
    expect(() => combinationsWithRepBn(bn('2.5'), bn(1))).toThrow(
      'Positive integer value expected in function combinationsWithRep'
    );
  });
});

describe('schoolbook integer multiply (mul / mulP)', () => {
  it('(x+1)^2 = 1 + 2x + x^2', () => {
    expect(mul(P(1, 1), P(1, 1))).toEqual(P(1, 2, 1));
  });

  it('multiply by zero polynomial', () => {
    expect(mul(P(1, 2, 3), P())).toEqual(P());
    expect(mul(P(), P(1))).toEqual(P());
  });

  it('skips zero middle coefficient', () => {
    expect(mul(P(1, 0, 1), P(1, 1))).toEqual(P(1, 1, 1, 1));
  });

  it('negative coefficients', () => {
    expect(mul(P(1, -1), P(1, 1))).toEqual(P(1, 0, -1));
  });

  it('mulP matches stepwise mod and trims zeros mod p', () => {
    const p = 7n;
    const a = P(3, 5);
    const b = P(2, 1);
    expect(mulP(a, b, p)).toEqual(mul(a, b).map((c) => ((c % p) + p) % p));
    expect(mulP(P(7, 1), P(1), p)).toEqual(P(0, 1));
  });

  it('mulP empty, p-boundary, and negative coefficients', () => {
    expect(mulP(P(), P(1, 2), 7n)).toEqual(P());
    expect(mulP(P(7, 14), P(1), 7n)).toEqual(P());
    expect(mulP(P(-3, 5), P(2, -1), 7n)).toEqual(P(1, 6, 2));
    expect(mulP(P(2, 2), P(1, 1), 2n)).toEqual(P());
  });

  it('mulP moderate degree matches unreduced-then-mod oracle', () => {
    const p = 101n;
    const a = P(1, 2, 3, 4, 5);
    const b = P(6, 7, 8);
    const unreduced = mul(a, b);
    const oracle = unreduced.map((c) => ((c % p) + p) % p);
    while (oracle.length > 0 && oracle[oracle.length - 1] === 0n) {
      oracle.pop();
    }
    expect(mulP(a, b, p)).toEqual(oracle);
  });
});

describe('binomialExact via chooseScalar (M16)', () => {
  it('eulerNumbers(6) unchanged', () => {
    expect(eulerNumbers(6)).toEqual([1, 0, -1, 0, 5, 0, -61]);
  });

  it('eulerNumbers(0) = [1]', () => {
    expect(eulerNumbers(0)).toEqual([1]);
  });

  it('chooseScalar(5, 2) = 10', () => {
    expect(chooseScalar(5, 2)).toBe(10);
  });

  it('chooseScalar out of range returns 0', () => {
    expect(chooseScalar(5, -1)).toBe(0);
    expect(chooseScalar(3, 10)).toBe(0);
  });

  it('chooseScalar drifts from exact binomial at large n; Math.round matches at moderate n', () => {
    expect(chooseScalar(67, 33)).not.toBe(Number(binomialBigInt(67n, 33n)));
    expect(Math.round(chooseScalar(40, 20))).toBe(Number(binomialBigInt(40n, 20n)));
  });
});
