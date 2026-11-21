import { afterEach, describe, it, expect } from 'vitest';
import { BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import { gcdBigInt } from '@danielsimonjr/mathts-core/internal';
import * as f from '../src/index.js';
import { MathJSDenseMatrix, MathJSSparseMatrix } from '../src/factories/matrix-bridge.js';
import {
  bitAndBigNumber,
  bitNotBigNumber,
  bitOrBigNumber,
  bitXor as bitXorBigNumber,
} from '../src/utils/bignumber/bitwise.js';

/**
 * Batch F2 (#1164, #1097, #1096, #1137, #1093): integer functions of BigNumber, Fraction and
 * bigint arguments, through the public typed API. The expression-language rows (evaluate and
 * parse) are in `compat/tests/bignumber-integer-f2.test.ts`.
 *
 * Oracle: mathjs 15.2.0 for the shape and the error texts, Python 3 (`math.comb`, `math.gcd`,
 * exact integer arithmetic) for the values. Where mathjs breaks the Bezout identity
 * (`xgcd(bignumber(12), bignumber(-8))`), the expected value is the one that satisfies it.
 */
type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const bn = (v: string | number): BigNumber => BigNumber.parse(String(v));
const str = (x: unknown): string => String(x);
const big = (x: unknown): string => (x as BigNumber).toFixed(0);
const frac = (x: unknown): string => {
  const q = x as Fraction;
  return `${q.numerator}/${q.denominator}`;
};
const F = (n: bigint, d: bigint = 1n): Fraction => new Fraction(n, d);

// Type fixture (compile only): gcd and lcm of two Fractions return a Fraction (#1096).
const typeFixture = (a: Fraction, b: Fraction): Fraction => f.gcd(a, b);
void typeFixture;

afterEach(() => {
  BigNumber.resetConfig();
});

const X = '987654321098765432109876';
const Y = '123456789012345';
const INTEGER_MSG = 'Parameters in function xgcd must be integer numbers';

/** Exact C(n, k) as a bigint, by an independent loop. */
function binomialRef(n: bigint, k: bigint): bigint {
  const kk = k < n - k ? k : n - k;
  let c = 1n;
  for (let i = 1n; i <= kk; i++) c = (c * (n - kk + i)) / i;
  return c;
}

describe('#1164 A xgcd of integers longer than a double', () => {
  for (const precision of [20, 64]) {
    it(`#1164 xgcd(BigNumber, BigNumber) is exact at precision ${precision}`, () => {
      BigNumber.config({ precision });
      const res = fn('xgcd')(bn(X), bn(Y)) as BigNumber[];
      expect(res.every((v) => v instanceof BigNumber)).toBe(true);
      // The coefficients are exact integers at every precision, so a*x + b*y = g holds
      // (the same pin as bignumber-mod-gcd-1118.test.ts for the factory).
      expect(res.map(big)).toEqual(['3', '5330323120803', '-42642585355004793538465']);
      expect(BigInt(X) * BigInt(big(res[1])) + BigInt(Y) * BigInt(big(res[2]))).toBe(3n);
    });
  }

  it('#1164 xgcd of numbers throws a RangeError when a coefficient is not a safe integer (mathjs gives the wrong [3, 0, 1])', () => {
    // The exact y of xgcd(2^60, 3) is -384307168202282325: as a number it rounds to
    // -384307168202282300, and 2^60 * 1 + 3 * that is 64, not 1.
    expect(() => fn('xgcd')(2 ** 60, 3)).toThrow(RangeError);
    expect(() => fn('xgcd')(2 ** 60, 3)).toThrow(/not a safe integer/);
    expect(() => fn('xgcd')(1e20, 3)).toThrow(RangeError);
    // The exact triples of the same operands through bigint and BigNumber.
    expect(fn('xgcd')(2n ** 60n, 3n)).toEqual([1n, 1n, -384307168202282325n]);
    expect((fn('xgcd')(bn((2n ** 60n).toString()), bn(3)) as BigNumber[]).map(big)).toEqual([
      '1',
      '1',
      '-384307168202282325',
    ]);
    expect(fn('xgcd')(10n ** 20n, 3n)).toEqual([1n, 1n, -33333333333333333333n]);
    // Operands above 2^53 with safe coefficients keep a number result; the gcd is exact.
    expect(fn('xgcd')(2 ** 60, 0)).toEqual([2 ** 60, 1, 0]);
    expect(fn('xgcd')(2 ** 60, 2 ** 61)).toEqual([2 ** 60, 1, 0]);
    expect(fn('xgcd')(2 ** 60, 4)).toEqual([4, 0, 1]);
    // The largest safe coefficient is still returned.
    const m = Number.MAX_SAFE_INTEGER;
    const [g, x, y] = fn('xgcd')(m, m - 1) as number[];
    expect(BigInt(m) * BigInt(x) + BigInt(m - 1) * BigInt(y)).toBe(BigInt(g));
  });

  it('#1097 xgcd of numbers follows the mathjs signs and has no negative zero', () => {
    expect(fn('xgcd')(8, 12)).toEqual([4, -1, 1]);
    expect(fn('xgcd')(-12, 8)).toEqual([4, 1, 2]);
    expect(fn('xgcd')(12, -8)).toEqual([4, -1, -2]);
    expect(fn('xgcd')(0, 0)).toEqual([0, 0, 0]);
    expect(fn('xgcd')(0, 5)).toEqual([5, 0, 1]);
    expect(fn('xgcd')(-7, 0)).toEqual([7, -1, 0]);
  });

  it('#1097 xgcd of numbers: a*x + b*y = g, g >= 0 and no -0 for a, b in -20..20', () => {
    for (let a = -20; a <= 20; a++) {
      for (let b = -20; b <= 20; b++) {
        const [g, x, y] = fn('xgcd')(a, b) as number[];
        expect(a * x + b * y).toBe(g);
        expect(g).toBeGreaterThanOrEqual(0);
        for (const v of [g, x, y]) expect(Object.is(v, -0)).toBe(false);
      }
    }
  });

  it('#1097 xgcd of bigints and of BigNumbers satisfies the same identity', () => {
    for (let a = -9; a <= 9; a++) {
      for (let b = -9; b <= 9; b++) {
        const [g, x, y] = fn('xgcd')(BigInt(a), BigInt(b)) as bigint[];
        expect(BigInt(a) * x + BigInt(b) * y).toBe(g);
        expect(g >= 0n).toBe(true);
        const r = fn('xgcd')(bn(a), bn(b)) as unknown[];
        expect(r.map(str)).toEqual(
          (fn('xgcd')(a, b) as number[]).map((v, i) => (i === 1 && v === 0 ? '0' : str(v)))
        );
      }
    }
  });

  it('#1164 xgcd of mixed BigNumber and number gives BigNumbers (mathjs)', () => {
    const r = fn('xgcd')(bn(12), 8) as BigNumber[];
    expect(r.every((v) => v instanceof BigNumber)).toBe(true);
    expect(r.map(str)).toEqual(['4', '1', '-1']);
    const s = fn('xgcd')(8, bn(12)) as BigNumber[];
    expect(s.every((v) => v instanceof BigNumber)).toBe(true);
    expect(s.map(str)).toEqual(['4', '-1', '1']);
  });

  it('#1097 xgcd of BigNumbers with a negative operand satisfies the Bezout identity', () => {
    // mathjs gives [4, 1, 2] here, and 12 * 1 + (-8) * 2 = -4. The expected value is the number result.
    expect((fn('xgcd')(bn(12), bn(-8)) as BigNumber[]).map(str)).toEqual(['4', '-1', '-2']);
    expect((fn('xgcd')(bn(-12), bn(8)) as BigNumber[]).map(str)).toEqual(['4', '1', '2']);
  });

  it('#1097 xgcd of two BigNumber zeros keeps the mathjs number 0 in the middle', () => {
    const r = fn('xgcd')(bn(0), bn(0)) as unknown[];
    expect(str(r[0])).toBe('0');
    expect(r[1]).toBe(0);
    expect(str(r[2])).toBe('0');
  });

  it('#1097 xgcd of Fractions with integer value', () => {
    expect((fn('xgcd')(F(12n), F(8n)) as Fraction[]).map(frac)).toEqual(['4/1', '1/1', '-1/1']);
    expect((fn('xgcd')(F(-12n), F(8n)) as Fraction[]).map(frac)).toEqual(['4/1', '1/1', '2/1']);
    expect(() => fn('xgcd')(F(1n, 2n), F(8n))).toThrow(INTEGER_MSG);
  });

  it('#1097 xgcd throws the integer error for NaN, Infinity and a fraction of every type', () => {
    expect(() => fn('xgcd')(NaN, 4)).toThrow(INTEGER_MSG);
    expect(() => fn('xgcd')(Infinity, 4)).toThrow(INTEGER_MSG);
    expect(() => fn('xgcd')(0.1, 4)).toThrow(INTEGER_MSG);
    expect(() => fn('xgcd')(4, 0.1)).toThrow(INTEGER_MSG);
    expect(() => fn('xgcd')(bn('NaN'), 4)).toThrow(INTEGER_MSG);
    expect(() => fn('xgcd')(bn('0.1'), 4)).toThrow(INTEGER_MSG);
    expect(() => fn('xgcd')(bn('Infinity'), bn(4))).toThrow(INTEGER_MSG);
    expect(() => fn('xgcd')(bn(4), bn('NaN'))).toThrow(INTEGER_MSG);
  });
});

describe('#1164 B combinations of BigNumbers', () => {
  const C200_100 = binomialRef(200n, 100n);

  it('#1164 combinations(bignumber(200), bignumber(100)) is exact (mathjs: 9.05...e+58)', () => {
    BigNumber.config({ precision: 64 });
    const r = fn('combinations')(bn(200), bn(100)) as BigNumber;
    expect(r).toBeInstanceOf(BigNumber);
    expect(big(r)).toBe(C200_100.toString());
    expect(big(r)).toBe('90548514656103281165404177077484163874504589675413336841320');
  });

  it('#1164 mixed BigNumber and number give a BigNumber (mathjs)', () => {
    BigNumber.config({ precision: 64 });
    const a = fn('combinations')(bn(200), 100) as BigNumber;
    const b = fn('combinations')(200, bn(100)) as BigNumber;
    expect(a).toBeInstanceOf(BigNumber);
    expect(b).toBeInstanceOf(BigNumber);
    expect(big(a)).toBe(C200_100.toString());
    expect(big(b)).toBe(C200_100.toString());
  });

  it('#1164 combinations of BigNumbers: edges and errors', () => {
    expect(str(fn('combinations')(bn(5), bn(0)))).toBe('1');
    expect(str(fn('combinations')(bn(2), bn(2)))).toBe('1');
    expect(str(fn('combinations')(bn(7), bn(5)))).toBe('21');
    for (const [n, k] of [
      [-1, 2],
      ['NaN', 2],
      [2.5, 2],
      [5, -1],
      [5, 'Infinity'],
    ] as const) {
      expect(() => fn('combinations')(bn(n), bn(k))).toThrow(TypeError);
      expect(() => fn('combinations')(bn(n), bn(k))).toThrow(
        'Positive integer value expected in function combinations'
      );
    }
    expect(() => fn('combinations')(bn(2), bn(5))).toThrow(
      'k must be less than n in function combinations'
    );
  });

  it('#1164 combinations of numbers: k > n gives the mathjs text', () => {
    expect(() => fn('combinations')(2, 5)).toThrow(TypeError);
    expect(() => fn('combinations')(2, 5)).toThrow(/^k must be less than or equal to n$/);
  });

  it('#1164 combinations of numbers is unchanged', () => {
    expect(fn('combinations')(7, 5)).toBe(21);
    expect(fn('combinations')(200, 100)).toBe(9.054851465610328e58);
    expect(fn('combinations')(10, 0)).toBe(1);
  });

  it('#1164 combinations of a collection and a BigNumber maps through the BigNumber path', () => {
    const r = fn('combinations')([bn(5), bn(6)], bn(2)) as BigNumber[];
    expect(r.map(str)).toEqual(['10', '15']);
    expect(r.every((v) => v instanceof BigNumber)).toBe(true);
    const s = fn('combinations')(bn(5), [1, 2]) as BigNumber[];
    expect(s.map(str)).toEqual(['5', '10']);
    expect(s.every((v) => v instanceof BigNumber)).toBe(true);
    expect(fn('combinations')([5, 6], 2)).toEqual([10, 15]);
    expect(fn('combinations')(5, [1, 2])).toEqual([5, 10]);
  });
});

describe('#1164 B2 combinationsWithRep: the same root cause as combinations', () => {
  // The typed function had no BigNumber row, so the dispatch converted a BigNumber to a number and
  // the value lost its digits. The parse path ran a second implementation (a BigNumber loop).
  const MULTISET = binomialRef(449n, 150n); // C(300 + 150 - 1, 150)

  it('#1164 combinationsWithRep of BigNumbers is an exact BigNumber rounded one time', () => {
    BigNumber.config({ precision: 64 });
    const r = fn('combinationsWithRep')(bn(300), bn(150)) as BigNumber;
    expect(r).toBeInstanceOf(BigNumber);
    expect(r.toString()).toBe(BigNumber.fromBigInt(MULTISET).toSignificantDigits(64).toString());
    BigNumber.config({ precision: 20 });
    const r20 = fn('combinationsWithRep')(bn(300), bn(150)) as BigNumber;
    expect(r20.toString()).toBe(BigNumber.fromBigInt(MULTISET).toSignificantDigits(20).toString());
  });

  it('#1164 a BigNumber with a number gives a BigNumber (mathjs)', () => {
    BigNumber.config({ precision: 64 });
    const a = fn('combinationsWithRep')(bn(8), 3) as BigNumber;
    const b = fn('combinationsWithRep')(3, bn(8)) as BigNumber;
    expect(a).toBeInstanceOf(BigNumber);
    expect(b).toBeInstanceOf(BigNumber);
    expect(str(a)).toBe('120');
    expect(str(b)).toBe('45');
  });

  it('#1164 combinationsWithRep: edges and the mathjs error texts', () => {
    expect(str(fn('combinationsWithRep')(bn(5), bn(0)))).toBe('1');
    expect(str(fn('combinationsWithRep')(bn(1), bn(7)))).toBe('1');
    expect(fn('combinationsWithRep')(5, 3)).toBe(35);
    expect(fn('combinationsWithRep')(5, 0)).toBe(1);
    for (const [n, k] of [
      [-1, 3],
      [5, 2.5],
      [5, -1],
      [2.5, 3],
    ] as const) {
      expect(() => fn('combinationsWithRep')(n, k)).toThrow(
        /^Positive integer value expected in function combinationsWithRep$/
      );
      expect(() => fn('combinationsWithRep')(bn(n), bn(k))).toThrow(
        /^Positive integer value expected in function combinationsWithRep$/
      );
    }
    expect(() => fn('combinationsWithRep')(0, 3)).toThrow(
      /^k must be less than or equal to n \+ k - 1$/
    );
    expect(() => fn('combinationsWithRep')(bn(0), bn(3))).toThrow(
      /^k must be less than or equal to n \+ k - 1 in function combinationsWithRep$/
    );
  });

  it('#1164 combinationsWithRep of numbers above 2^53 is exact (no endpoint product)', () => {
    // C(1e20 + 1, 2) is 5e39 + 5e19; the old parse path divided a range product whose endpoints
    // rounded to the same double and gave 5e19.
    expect(fn('combinationsWithRep')(1e20, 2)).toBe(5e39);
  });

  it('#1164 a bigint or a Fraction argument is read as a number', () => {
    expect(fn('combinationsWithRep')(5n, 2n)).toBe(15);
    expect(fn('combinationsWithRep')(F(5n), F(2n))).toBe(15);
  });
});

describe('#1164 C isPrime of a BigNumber', () => {
  it('#1164 isPrime(bignumber(1000000000000037)) at precision 20 is true', () => {
    BigNumber.config({ precision: 20 });
    expect(fn('isPrime')(bn('1000000000000037'))).toBe(true);
  });

  it('#1164 isPrime(bignumber(2^127 - 1)) at precision 64 is true, 2^127 + 1 is false', () => {
    BigNumber.config({ precision: 64 });
    expect(fn('isPrime')(bn('170141183460469231731687303715884105727'))).toBe(true);
    expect(fn('isPrime')(bn('170141183460469231731687303715884105729'))).toBe(false);
  });

  it('#1164 isPrime rejects composites below and at the Miller-Rabin bound', () => {
    expect(fn('isPrime')(bn(3215031751))).toBe(false);
    // The strong pseudoprime to the 13 prime bases 2 to 41 (mathjs: false).
    expect(fn('isPrime')(bn('3317044064679887385961981'))).toBe(false);
    expect(fn('isPrime')(bn(-7))).toBe(false);
    expect(fn('isPrime')(bn(7.5))).toBe(true);
  });

  it('#1164 isPrime of NaN and Infinity is false and does not throw', () => {
    expect(fn('isPrime')(bn('NaN'))).toBe(false);
    expect(fn('isPrime')(bn('Infinity'))).toBe(false);
  });

  it('#1164 isPrime of a non-integer above 2^32 is false (no hang)', () => {
    expect(fn('isPrime')(bn('4294967297.5'))).toBe(false);
  });

  it('#1137 isPrime leaves the precision as it found it', () => {
    BigNumber.config({ precision: 20 });
    fn('isPrime')(bn('170141183460469231731687303715884105727'));
    expect(BigNumber.precision).toBe(20);
  });
});

describe('#1097 nthRoot of a negative BigNumber', () => {
  it('#1097 nthRoot(bignumber(-8), 2) and (…, bignumber(2)) throw like mathjs', () => {
    expect(() => fn('nthRoot')(bn(-8), 2)).toThrow('Root must be odd when a is negative.');
    expect(() => fn('nthRoot')(bn(-8), bn(2))).toThrow('Root must be odd when a is negative.');
    expect(() => fn('nthRoot')(bn(-8), 2.5)).toThrow('Root must be odd when a is negative.');
  });

  it('#1097 nthRoot(bignumber(-8), 3) is -2 and the number path still throws', () => {
    expect(str(fn('nthRoot')(bn(-8), 3))).toBe('-2');
    expect(() => fn('nthRoot')(-8, 2)).toThrow();
  });
});

describe('#1097 permutations', () => {
  it('#1097 permutations of BigNumbers (mathjs: BigNumber)', () => {
    for (const r of [
      fn('permutations')(bn(10), bn(3)),
      fn('permutations')(bn(10), 3),
      fn('permutations')(10, bn(3)),
    ]) {
      expect(r).toBeInstanceOf(BigNumber);
      expect(str(r)).toBe('720');
    }
    const one = fn('permutations')(bn(10));
    expect(one).toBeInstanceOf(BigNumber);
    expect(str(one)).toBe('3628800');
    expect(str(fn('permutations')(bn(5), bn(0)))).toBe('1');
    expect(str(fn('permutations')(bn(0)))).toBe('1');
  });

  it('#1097 permutations of a BigNumber is exact above the precision', () => {
    BigNumber.config({ precision: 64 });
    let exact = 1n;
    for (let i = 1n; i <= 40n; i++) exact *= i;
    expect(big(fn('permutations')(bn(40)))).toBe(exact.toString());
    expect(big(fn('permutations')(bn(40), bn(40)))).toBe(exact.toString());
  });

  it('#1097 permutations errors of BigNumbers match mathjs', () => {
    for (const [n, k] of [
      ['NaN', 2],
      [-1, 2],
    ] as const) {
      expect(() => fn('permutations')(bn(n), bn(k))).toThrow(TypeError);
      expect(() => fn('permutations')(bn(n), bn(k))).toThrow(
        'Positive integer value expected in function permutations'
      );
    }
    expect(() => fn('permutations')(bn(5), bn(6))).toThrow(TypeError);
    expect(() => fn('permutations')(bn(5), bn(6))).toThrow(
      'second argument k must be less than or equal to first argument n'
    );
    expect(() => fn('permutations')(bn(2.5))).toThrow('Integer BigNumber expected');
    expect(() => fn('permutations')(bn('NaN'))).toThrow('Integer BigNumber expected');
    expect(() => fn('permutations')(bn(-1))).toThrow('Value must be non-negative');
  });

  it('#1097 permutations errors of numbers give the mathjs texts', () => {
    expect(() => fn('permutations')(-1, 2)).toThrow(TypeError);
    expect(() => fn('permutations')(-1, 2)).toThrow(
      'Positive integer value expected in function permutations'
    );
    expect(() => fn('permutations')(2.5, 1)).toThrow(
      'Positive integer value expected in function permutations'
    );
    expect(() => fn('permutations')(5, -1)).toThrow(
      'Positive integer value expected in function permutations'
    );
    expect(() => fn('permutations')(2, 5)).toThrow(TypeError);
    expect(() => fn('permutations')(2, 5)).toThrow(
      'second argument k must be less than or equal to first argument n'
    );
  });

  it('#1097 permutations of collections (the factory signatures)', () => {
    expect(fn('permutations')([5, 6], 2)).toEqual([20, 30]);
    expect(fn('permutations')([5, 6])).toEqual([120, 720]);
    expect(fn('permutations')(5, [1, 2])).toEqual([5, 20]);
    const m = fn('permutations')(f.matrix([5, 6]), 2) as { toArray(): number[] };
    expect(m.toArray()).toEqual([20, 30]);
    const b = fn('permutations')([bn(5), bn(6)], bn(2)) as BigNumber[];
    expect(b.map(str)).toEqual(['20', '30']);
  });

  it('#1097 permutations(170) equals factorial(170) and permutations(170, 170)', () => {
    expect(fn('permutations')(170)).toBe(7.257415615307998e306);
    expect(fn('permutations')(170)).toBe(fn('factorial')(170));
    expect(fn('permutations')(170, 170)).toBe(7.257415615307998e306);
    expect(fn('permutations')(171)).toBe(Infinity);
    expect(fn('permutations')(5)).toBe(120);
    expect(fn('permutations')(5, 3)).toBe(60);
    expect(fn('permutations')(5, 0)).toBe(1);
  });

  it('#1097 permutations of large numbers ends and is exact where a double can be', () => {
    expect(fn('permutations')(200, 2)).toBe(39800);
    expect(fn('permutations')(2 ** 40, 2)).toBe(2 ** 40 * (2 ** 40 - 1));
    // n - 1 and n are doubles, and their product rounds one time.
    expect(fn('permutations')(2 ** 53 - 2, 2)).toBe((2 ** 53 - 2) * (2 ** 53 - 3));
    expect(fn('permutations')(2 ** 53, 2)).toBe(2 ** 53 * (2 ** 53 - 1));
  });
});

describe('#1097 bitwise functions of a BigNumber NaN', () => {
  const NAN = BigNumber.parse('NaN');
  const binary = ['bitAnd', 'bitOr', 'bitXor', 'leftShift', 'rightArithShift'] as const;

  for (const name of binary) {
    it(`#1097 ${name} gives a BigNumber NaN for a NaN operand in either place`, () => {
      const a = fn(name)(NAN, bn(1)) as BigNumber;
      const b = fn(name)(bn(1), NAN) as BigNumber;
      const c = fn(name)(NAN, NAN) as BigNumber;
      for (const r of [a, b, c]) {
        expect(r).toBeInstanceOf(BigNumber);
        expect(r.isNaN()).toBe(true);
      }
    });

    it(`#1097 ${name} still throws for a finite non-integer operand`, () => {
      expect(() => fn(name)(bn(1.5), bn(1))).toThrow(`Integers expected in function ${name}`);
      expect(() => fn(name)(bn(1), bn(1.5))).toThrow(`Integers expected in function ${name}`);
      // The non-integer test runs before the NaN test, as in mathjs.
      expect(() => fn(name)(NAN, bn(1.5))).toThrow(`Integers expected in function ${name}`);
      expect(() => fn(name)(bn(1.5), NAN)).toThrow(`Integers expected in function ${name}`);
    });
  }

  it('#1097 bitNot of a BigNumber NaN is NaN', () => {
    const r = fn('bitNot')(NAN) as BigNumber;
    expect(r).toBeInstanceOf(BigNumber);
    expect(r.isNaN()).toBe(true);
    expect(() => fn('bitNot')(bn(1.5))).toThrow('Integers expected in function bitNot');
  });

  it('#1097 bitAnd of a BigNumber NaN and a number is a BigNumber NaN', () => {
    expect((fn('bitAnd')(NAN, 1) as BigNumber).isNaN()).toBe(true);
    expect((fn('bitAnd')(1, NAN) as BigNumber).isNaN()).toBe(true);
  });

  it('#1097 a NaN in one place and an Infinity in the other gives NaN', () => {
    expect((fn('bitAnd')(bn('Infinity'), NAN) as BigNumber).isNaN()).toBe(true);
    expect((fn('leftShift')(NAN, bn('Infinity')) as BigNumber).isNaN()).toBe(true);
  });

  it('#1097 bitAnd of numbers and finite BigNumbers is unchanged', () => {
    expect(() => fn('bitAnd')(NaN, 1.5)).toThrow('Integers expected in function bitAnd');
    expect(() => fn('bitAnd')(1.5, 1)).toThrow('Integers expected in function bitAnd');
    expect(str(fn('bitAnd')(bn(12), bn(10)))).toBe('8');
    expect(str(fn('leftShift')(bn(1), bn(70)))).toBe('1180591620717411303424');
    expect(() => fn('leftShift')(bn(1), bn(-1))).toThrow(/Negative shift count/);
  });
});

describe('#1097 mod of two BigNumbers takes the sign of the divisor', () => {
  // The typed row called the truncated `BigNumber.mod`, which takes the sign of the dividend.
  // The factory row adds the divisor when the signs differ, and so does mathjs.
  const mod = (a: unknown, b: unknown): string => String(fn('mod')(a, b));

  it('#1097 a negative dividend or divisor gives the floored remainder', () => {
    expect(mod(bn(-1), bn(5))).toBe('4');
    expect(mod(bn(-7), bn(3))).toBe('2');
    expect(mod(bn(7), bn(-3))).toBe('-2');
    expect(mod(bn(-7), bn(-3))).toBe('-1');
    expect(mod(bn('-7.5'), bn(2))).toBe('0.5');
    expect(mod(bn(7), bn(3))).toBe('1');
    expect(mod(bn(-6), bn(3))).toBe('0');
  });

  it('#1097 a divisor of zero returns the dividend, a number operand is converted', () => {
    expect(mod(bn(-7), bn(0))).toBe('-7');
    expect(mod(-1, bn(5))).toBe('4');
    expect(mod(bn(-1), 5)).toBe('4');
  });

  it('#1097 a NaN or infinite operand gives NaN, as mathjs (x - y * floor(x / y))', () => {
    // BigNumber.mod returns the dividend for an infinite divisor. The floored step then added the
    // infinite divisor to a negative dividend and gave Infinity.
    expect(mod(bn(-1), bn(Infinity))).toBe('NaN');
    expect(mod(bn(1), bn(Infinity))).toBe('NaN');
    expect(mod(bn(1), bn(-Infinity))).toBe('NaN');
    expect(mod(bn(-1), bn(-Infinity))).toBe('NaN');
    expect(mod(bn(Infinity), bn(5))).toBe('NaN');
    expect(mod(bn(NaN), bn(5))).toBe('NaN');
    expect(mod(bn(5), bn(NaN))).toBe('NaN');
    expect(mod(bn(Infinity), bn(0))).toBe('Infinity');
  });

  it('#1097 the remainder of 30 digits is exact at precision 20 and 64', () => {
    for (const precision of [20, 64]) {
      BigNumber.config({ precision });
      expect(mod(bn('-123456789012345678901234567890123'), bn('777777777777777777777'))).toBe(
        '320987765308641987531'
      );
    }
  });
});

describe('#1097 the BigNumber bitwise helpers of the parse path', () => {
  // The helpers served the digit array of decimal.js (`x.d`, `x.e`, `x.s`), which a core BigNumber
  // does not have: a finite operand threw `Cannot read properties of undefined`, and `bitNot`
  // wrote the sign field of a value that stores no such field, so it did not change the sign.
  // Oracle: mathjs 15.2.0.
  type Binary = (a: unknown, b: unknown) => BigNumber;
  const and = bitAndBigNumber as unknown as Binary;
  const or = bitOrBigNumber as unknown as Binary;
  const xor = bitXorBigNumber as unknown as Binary;
  const not = bitNotBigNumber as unknown as (a: unknown) => BigNumber;
  const BIG = '123456789012345678901234567890';

  it('#1097 bitAnd, bitOr and bitXor of finite integers give the mathjs values', () => {
    expect(big(and(bn(12), bn(10)))).toBe('8');
    expect(big(and(bn(-12), bn(3)))).toBe('0');
    expect(big(and(bn(-5), bn(-3)))).toBe('-7');
    expect(big(and(bn(-5), bn(12)))).toBe('8');
    expect(big(or(bn(12), bn(10)))).toBe('14');
    expect(big(or(bn(-12), bn(3)))).toBe('-9');
    expect(big(or(bn(-5), bn(-3)))).toBe('-1');
    expect(big(or(bn(5), bn(-12)))).toBe('-11');
    expect(big(xor(bn(12), bn(10)))).toBe('6');
    expect(big(xor(bn(-12), bn(3)))).toBe('-9');
    expect(big(xor(bn(-5), bn(-12)))).toBe('15');
  });

  it('#1097 the operands are not limited to a double (30 digits)', () => {
    expect(big(or(bn(BIG), bn(5)))).toBe('123456789012345678901234567895');
    expect(big(xor(bn(BIG), bn(5)))).toBe('123456789012345678901234567895');
    expect(big(and(bn(BIG), bn(5)))).toBe('0');
    expect(big(and(bn('1e30'), bn('-1e25')))).toBe('999990307047208028400261267456');
  });

  it('#1097 bitNot is -x - 1, and bitXor with -1 is bitNot of the other operand', () => {
    expect(big(not(bn(12)))).toBe('-13');
    expect(big(not(bn(-12)))).toBe('11');
    expect(big(not(bn(0)))).toBe('-1');
    expect(big(not(bn(-1)))).toBe('0');
    expect(big(not(bn(BIG)))).toBe('-123456789012345678901234567891');
    expect(big(xor(bn(-1), bn(5)))).toBe('-6');
    expect(big(xor(bn(5), bn(-1)))).toBe('-6');
    expect(big(xor(bn(-1), bn(-5)))).toBe('4');
  });

  it('#1097 the special cases of an infinite or NaN operand are kept', () => {
    expect(str(not(bn('Infinity')))).toBe('-Infinity');
    expect(str(not(bn('-Infinity')))).toBe('Infinity');
    expect(str(not(bn('NaN')))).toBe('NaN');
    expect(str(and(bn('Infinity'), bn(5)))).toBe('5');
    expect(str(or(bn('Infinity'), bn(5)))).toBe('Infinity');
    expect(str(xor(bn(-1), bn('Infinity')))).toBe('-Infinity');
    expect(() => and(bn('1.5'), bn(2))).toThrow('Integers expected in function bitAnd');
    expect(() => not(bn('1.5'))).toThrow('Integer expected in function bitNot');
  });
});

describe('#1096 gcd and lcm of Fractions and of more than two values', () => {
  it('#1096 gcd and lcm of two Fractions (mathjs)', () => {
    expect(frac(fn('gcd')(F(1n, 2n), F(1n, 3n)))).toBe('1/6');
    expect(frac(fn('lcm')(F(1n, 2n), F(1n, 3n)))).toBe('1/1');
    expect(frac(fn('gcd')(F(-1n, 2n), F(1n, 3n)))).toBe('1/6');
    expect(frac(fn('gcd')(F(0n), F(1n, 3n)))).toBe('1/3');
    expect(frac(fn('lcm')(F(0n), F(1n, 3n)))).toBe('0/1');
  });

  it('#1096 a number with a Fraction is read as a Fraction', () => {
    expect(frac(fn('gcd')(F(1n, 2n), 3))).toBe('1/2');
    expect(frac(fn('gcd')(3, F(1n, 2n)))).toBe('1/2');
    expect(frac(fn('lcm')(F(1n, 2n), 3))).toBe('3/1');
    expect(frac(fn('gcd')(0, F(1n, 3n)))).toBe('1/3');
    expect(frac(fn('lcm')(0, F(1n, 3n)))).toBe('0/1');
  });

  it('#1096 gcd and lcm of three Fractions', () => {
    expect(frac(fn('gcd')(F(1n, 2n), F(1n, 3n), F(1n, 4n)))).toBe('1/12');
    expect(frac(fn('lcm')(F(1n, 2n), F(1n, 3n), F(1n, 4n)))).toBe('1/1');
  });

  it('#1096 gcd and lcm take more than two numbers, bigints and BigNumbers', () => {
    expect(fn('gcd')(4, 6, 8)).toBe(2);
    expect(fn('lcm')(4, 6, 8)).toBe(24);
    expect(fn('gcd')(25, 15, -10)).toBe(5);
    expect(fn('gcd')(12, 18, 30, 42)).toBe(6);
    expect(fn('lcm')(2, 3, 4, 5)).toBe(60);
    expect(fn('gcd')(4n, 6n, 8n)).toBe(2n);
    expect(fn('lcm')(4n, 6n, 8n)).toBe(24n);
    const g = fn('gcd')(bn(4), bn(6), bn(8)) as BigNumber;
    expect(g).toBeInstanceOf(BigNumber);
    expect(str(g)).toBe('2');
    expect(str(fn('lcm')(bn(4), bn(6), bn(8)))).toBe('24');
  });

  it('#1096 gcd and lcm of two values and of one vector are unchanged', () => {
    expect(fn('gcd')(12, 18)).toBe(6);
    expect(fn('lcm')(4, 6)).toBe(12);
    expect(fn('gcd')([12, 18, 30])).toBe(6);
    expect(() => fn('gcd')(1.5, 3)).toThrow('Parameters in function gcd must be integer numbers');
    expect(() => fn('gcd')(4, 6, 1.5)).toThrow(
      'Parameters in function gcd must be integer numbers'
    );
  });
});

describe('#1137 one bigint gcd and one modPow', () => {
  it('#1137 gcdBigInt is exported by core/internal and is non-negative', () => {
    expect(gcdBigInt(-12n, 18n)).toBe(6n);
    expect(gcdBigInt(12n, -18n)).toBe(6n);
    expect(gcdBigInt(0n, 0n)).toBe(0n);
    expect(gcdBigInt(0n, -5n)).toBe(5n);
    expect(gcdBigInt(2n ** 100n, 6n ** 50n)).toBe(2n ** 50n);
  });

  it('#1137 the bigint branch of gcd and the exact-identity helpers still agree', () => {
    expect(fn('gcd')(-12n, 18n)).toBe(6n);
    expect(fn('gcd')(0n, 0n)).toBe(0n);
    expect(fn('gcd')(2n ** 100n, 6n ** 50n)).toBe(2n ** 50n);
  });

  it('#1137 the number-theory functions that used a private copy still give their values', () => {
    // discreteLog, primitiveRoot and multiplicativeOrder used `modPowBig`; rationalNullspace and
    // the diophantine solver used a private gcd. Their own suites pin the full behaviour.
    expect(fn('discreteLog')(2, 8, 11)).toBe(3);
    expect(fn('primitiveRoot')(11)).toBe(2);
    expect(fn('multiplicativeOrder')(3, 7)).toBe(6);
  });
});

describe('#1093 multinomial', () => {
  it('#1093 multinomial of BigNumbers is a BigNumber', () => {
    const r = fn('multinomial')([bn(2), bn(3)]);
    expect(r).toBeInstanceOf(BigNumber);
    expect(str(r)).toBe('10');
    const mixed = fn('multinomial')([bn(2), 3]);
    expect(mixed).toBeInstanceOf(BigNumber);
    expect(str(mixed)).toBe('10');
  });

  it('#1093 multinomial of two BigNumbers of 20000 is exact (no 2^1024 cap, no 19 s)', () => {
    BigNumber.config({ precision: 64 });
    const exact = binomialRef(40000n, 20000n);
    const r = fn('multinomial')([bn(20000), bn(20000)]) as BigNumber;
    expect(r).toBeInstanceOf(BigNumber);
    expect(r).toEqual(BigNumber.fromBigInt(exact).toSignificantDigits(64));
    expect(str(r).replace('.', '').slice(0, 59)).toBe(
      '63202449561848590095130949530177785527214289537290468238316'
    );
  });

  it('#1093 multinomial of booleans (mathjs: true is 1, false is 0)', () => {
    expect(fn('multinomial')([true, true])).toBe(2);
    expect(() => fn('multinomial')([false, true])).toThrow(
      'Positive integer value expected in function multinomial'
    );
    expect(str(fn('multinomial')([true, bn(2)]))).toBe('3');
  });

  it('#1093 multinomial of numbers is unchanged', () => {
    expect(fn('multinomial')([2, 1, 1])).toBe(12);
    expect(fn('multinomial')([1, 2, 3])).toBe(60);
    expect(
      fn('multinomial')([
        [1, 2],
        [3, 4],
      ])
    ).toBe(12600);
    expect(fn('multinomial')(f.matrix([1, 2, 1]))).toBe(12);
    expect(fn('multinomial')([1000, 1000])).toBe(Infinity);
  });

  it('#1093 multinomial of a hole, a non-integer or a string throws the positive-integer error', () => {
    const msg = 'Positive integer value expected in function multinomial';
    // eslint-disable-next-line no-sparse-arrays -- a hole is the tested input
    expect(() => fn('multinomial')([1, , 2])).toThrow(msg);
    expect(() => fn('multinomial')([1, 2.5])).toThrow(msg);
    expect(() => fn('multinomial')([0, 1])).toThrow(msg);
    expect(() => fn('multinomial')([bn(2.5), bn(1)])).toThrow(msg);
    expect(() => fn('multinomial')([bn(0), bn(1)])).toThrow(msg);
    expect(() =>
      fn('multinomial')([
        [1, 2],
        [3, -1],
      ])
    ).toThrow(msg);
  });
});

describe('#1093 a matrix of matrices is one matrix', () => {
  const M = (data: unknown): MathJSDenseMatrix => new MathJSDenseMatrix(data as number[][]);

  it('#1093 an array of matrices is a 2-D matrix (mathjs: [2, 2])', () => {
    const m = M([M([1, 2]), M([3, 4])]);
    expect(m.size()).toEqual([2, 2]);
    expect(m.toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect((f.matrix([f.matrix([1, 2]), f.matrix([3, 4])]) as MathJSDenseMatrix).size()).toEqual([
      2, 2,
    ]);
  });

  it('#1093 a sparse matrix of matrices is one sparse matrix (mathjs: [2, 2])', () => {
    // The sparse constructor reads the same nested data, so it needs the same unwrap.
    const S = (data: unknown): MathJSSparseMatrix => new MathJSSparseMatrix(data as number[][]);
    const sp = S([M([1, 2]), M([3, 4])]);
    expect(sp.size()).toEqual([2, 2]);
    expect(sp.toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
    const mixed = S([M([0, 2]), [3, 0]]);
    expect(mixed.toArray()).toEqual([
      [0, 2],
      [3, 0],
    ]);
  });

  it('#1093 matrices and arrays may be mixed in the rows', () => {
    const m = M([[1, 2], M([3, 4])]);
    expect(m.size()).toEqual([2, 2]);
    expect(m.toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('#1093 a matrix of matrices of three levels unwraps at every level', () => {
    const m = M([M([M([1, 2]), M([3, 4])]), M([M([5, 6]), M([7, 8])])]);
    expect(m.size()).toEqual([2, 2, 2]);
  });

  it('#1093 rows of different sizes throw the dimension error', () => {
    expect(() => M([M([1, 2]), M([3])])).toThrow();
    expect(() => M([[1, 2], M([3])])).toThrow();
  });

  it('#1093 BigNumber and Complex entries are values, not matrices', () => {
    expect(M([bn(1), bn(2)]).size()).toEqual([2]);
    const c = f.complex(1, 2);
    expect(M([c, c]).size()).toEqual([2]);
  });

  it('#1093 the { data, size } form is not scanned', () => {
    const inner = M([1, 2]);
    const m = new MathJSDenseMatrix({ data: [inner] as unknown as number[][], size: [1] });
    expect(m.size()).toEqual([1]);
    expect(m._data[0]).toBe(inner as unknown as number[]);
  });

  it('#1093 plain numeric data keeps its values and is copied', () => {
    const rows = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const m = M(rows);
    expect(m.size()).toEqual([2, 3]);
    rows[0][0] = 99;
    expect((m.toArray() as number[][])[0][0]).toBe(1);
  });
});

describe('already fixed on main: pinned by F2', () => {
  it('#1164 lusolve of BigNumbers at precision 64', () => {
    BigNumber.config({ precision: 64 });
    const a = [
      [2, 1, 1],
      [1, 3, 2],
      [1, 0, 0],
    ].map((row) => row.map((v) => bn(v)));
    const r = fn('lusolve')(a, [bn(4), bn(5), bn(6)]) as unknown[];
    expect((r.flat(Infinity) as BigNumber[]).map(str)).toEqual(['6', '15', '-23']);
  });
});
