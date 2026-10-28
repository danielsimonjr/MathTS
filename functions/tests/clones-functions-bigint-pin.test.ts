/**
 * Oracle pins for clone batch PR 2 (M3 BigNumber combinations, M8 schoolbook mul, M16 binomialExact).
 */
import { describe, it, expect } from 'vitest';
import { factoryScope } from '../src/factories/scope.js';
import { mul } from '../src/typed/factorization/integer-poly.js';
import { mulP } from '../src/typed/factorization/finite-field.js';
import type { IntPoly } from '../src/typed/factorization/integer-poly.js';
import { eulerNumbers } from '../src/index.js';
import { chooseScalar } from '../src/wasm/special/scalars.js';
import {
  binomialProductBigNumber,
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

function legacyBn(value: number | bigint): LegacyBn {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  function LegacyBigNumberCtor(v: number): LegacyBn {
    return legacyBn(BigInt(v));
  }
  const self: LegacyBn = {
    __v: n,
    constructor: LegacyBigNumberCtor,
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
    isInteger: () => true,
    toString: () => n.toString(),
  };
  return self;
}

describe('binomialProductBigNumber', () => {
  it('C(7, 5) = 21 and C(60, 30) above 2^53', () => {
    expect(String(binomialProductBigNumber(legacyBn(7), legacyBn(5)))).toBe('21');
    expect(String(binomialProductBigNumber(legacyBn(60), legacyBn(30)))).toBe('118264581564861424');
  });

  it('with-rep total n+k-1: C(5+3-1, 3)', () => {
    expect(String(binomialProductBigNumber(legacyBn(7), legacyBn(3)))).toBe('35');
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
