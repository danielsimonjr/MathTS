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
import { createCombinations } from '../src/probability/combinations.js';
import { createCombinationsWithRep } from '../src/probability/combinationsWithRep.js';
import type { TypedFunction } from '../src/core/function/typed.js';
import {
  binomialProductBigNumber,
  isPositiveInteger,
  type BigNumberBinomialType,
} from '../src/probability/bigint-binomial.js';
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

type LegacyBn = BigNumberBinomialType & { __v: bigint };

function legacyBnCoerce(x: BigNumberBinomialType | number): bigint {
  return typeof x === 'number' ? BigInt(x) : (x as LegacyBn).__v;
}

function legacyBn(value: number | bigint, integer = true): LegacyBn {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  class LegacyBigNumberCtor {
    constructor(v: number) {
      return legacyBn(BigInt(v));
    }
  }
  const self: LegacyBn = {
    __v: n,
    constructor: LegacyBigNumberCtor as unknown as BigNumberBinomialType['constructor'],
    minus(x) {
      return legacyBn(n - legacyBnCoerce(x));
    },
    plus(x) {
      return legacyBn(n + legacyBnCoerce(x));
    },
    times(x) {
      return legacyBn(n * legacyBnCoerce(x));
    },
    dividedBy(x) {
      const d = legacyBnCoerce(x);
      if (n % d !== 0n) throw new Error('not divisible');
      return legacyBn(n / d);
    },
    lt(x) {
      return n < legacyBnCoerce(x);
    },
    gt(x) {
      return n > legacyBnCoerce(x);
    },
    lte(x) {
      return n <= legacyBnCoerce(x);
    },
    gte(x) {
      return n >= legacyBnCoerce(x);
    },
    isInteger: () => integer,
  };
  return self;
}

function stubTyped(
  _name: string,
  signatures: Record<string, (...args: never[]) => unknown>
): (n: unknown, k: unknown) => unknown {
  return (n: unknown, k: unknown) => {
    const key = typeof n === 'number' ? 'number, number' : 'BigNumber, BigNumber';
    return signatures[key](n as never, k as never);
  };
}

const combinationsBn = createCombinations({
  typed: stubTyped as unknown as TypedFunction,
}) as unknown as (n: BigNumberBinomialType, k: BigNumberBinomialType) => LegacyBn;

const combinationsWithRepBn = createCombinationsWithRep({
  typed: stubTyped as unknown as TypedFunction,
}) as unknown as (n: BigNumberBinomialType, k: BigNumberBinomialType) => LegacyBn;

describe('helpers stay off the package barrel', () => {
  it('does not export binomialProductBigNumber, schoolbookMul, isPositiveInteger, chooseScalar', () => {
    expect('binomialProductBigNumber' in functionsApi).toBe(false);
    expect('schoolbookMul' in functionsApi).toBe(false);
    expect('isPositiveInteger' in functionsApi).toBe(false);
    expect('chooseScalar' in functionsApi).toBe(false);
  });
});

describe('isPositiveInteger (shared by both factories)', () => {
  it('treats 0 as allowed (non-negative), rejects negatives and non-integers', () => {
    expect(isPositiveInteger(legacyBn(0))).toBe(true);
    expect(isPositiveInteger(legacyBn(1))).toBe(true);
    expect(isPositiveInteger(legacyBn(-1))).toBe(false);
    expect(isPositiveInteger(legacyBn(2, false))).toBe(false);
  });
});

describe('binomialProductBigNumber', () => {
  it('C(7, 5) = 21 and C(60, 30) above 2^53', () => {
    expect((binomialProductBigNumber(legacyBn(7), legacyBn(5)) as LegacyBn).__v.toString()).toBe(
      '21'
    );
    expect((binomialProductBigNumber(legacyBn(60), legacyBn(30)) as LegacyBn).__v.toString()).toBe(
      '118264581564861424'
    );
  });

  it('C(0, 0) = 1, C(5, 0) = 1, C(5, 1) = 5', () => {
    expect((binomialProductBigNumber(legacyBn(0), legacyBn(0)) as LegacyBn).__v.toString()).toBe(
      '1'
    );
    expect((binomialProductBigNumber(legacyBn(5), legacyBn(0)) as LegacyBn).__v.toString()).toBe(
      '1'
    );
    expect((binomialProductBigNumber(legacyBn(5), legacyBn(1)) as LegacyBn).__v.toString()).toBe(
      '5'
    );
  });

  it('with-rep total n+k-1: C(5+3-1, 3)', () => {
    expect((binomialProductBigNumber(legacyBn(7), legacyBn(3)) as LegacyBn).__v.toString()).toBe(
      '35'
    );
  });
});

describe('combinations / combinationsWithRep BigNumber factories', () => {
  it('C(7, 5) = 21 through the combinations factory', () => {
    expect(combinationsBn(legacyBn(7), legacyBn(5)).__v.toString()).toBe('21');
  });

  it('throws the combinations error strings', () => {
    expect(() => combinationsBn(legacyBn(-1), legacyBn(0))).toThrow(TypeError);
    expect(() => combinationsBn(legacyBn(-1), legacyBn(0))).toThrow(
      'Positive integer value expected in function combinations'
    );
    expect(() => combinationsBn(legacyBn(2, false), legacyBn(1))).toThrow(
      'Positive integer value expected in function combinations'
    );
    expect(() => combinationsBn(legacyBn(3), legacyBn(4))).toThrow(
      'k must be less than n in function combinations'
    );
  });

  it('with-rep C(n+k-1, k) for (1,0), (5,0), (5,1), (3,3)', () => {
    expect(combinationsWithRepBn(legacyBn(1), legacyBn(0)).__v.toString()).toBe('1');
    expect(combinationsWithRepBn(legacyBn(5), legacyBn(0)).__v.toString()).toBe('1');
    expect(combinationsWithRepBn(legacyBn(5), legacyBn(1)).__v.toString()).toBe('5');
    expect(combinationsWithRepBn(legacyBn(3), legacyBn(3)).__v.toString()).toBe('10');
  });

  it('throws the combinationsWithRep error strings', () => {
    expect(() => combinationsWithRepBn(legacyBn(-1), legacyBn(1))).toThrow(TypeError);
    expect(() => combinationsWithRepBn(legacyBn(-1), legacyBn(1))).toThrow(
      'Positive integer value expected in function combinationsWithRep'
    );
    expect(() => combinationsWithRepBn(legacyBn(0), legacyBn(1))).toThrow(
      'k must be less than or equal to n + k - 1 in function combinationsWithRep'
    );
    expect(() => combinationsWithRepBn(legacyBn(2, false), legacyBn(1))).toThrow(
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
