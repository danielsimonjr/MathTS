/**
 * Batch F2 (#1164, #1097, #1096, #1137, #1093) through the expression language of the compat
 * instance: `evaluate(...)` runs the typed functions, and `parse(...).evaluate()` runs the scope of
 * the mathjs-port factories. After F2 both run one implementation of `multinomial`,
 * `permutations`, `combinations` and `xgcd`. The typed-function rows (direct API calls) are in
 * `functions/tests/bignumber-integer-f2.test.ts`.
 *
 * Oracle: mathjs 15.2.0 (the container of `xgcd` is a DenseMatrix on the parse path and an Array
 * in compat `evaluate`; both give the same entries).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { create, all } from '../src/index.js';

interface Loose {
  evaluate(expr: string): unknown;
  parse(expr: string): { evaluate(): unknown };
}
const math = create(all) as unknown as Loose;
const ev = (e: string): unknown => math.evaluate(e);
const pv = (e: string): unknown => math.parse(e).evaluate();

const str = (x: unknown): string => String(x);
const big = (x: unknown): string => (x as BigNumber).toFixed(0);
const toArr = (v: unknown): unknown =>
  v !== null && typeof v === 'object' && typeof (v as { toArray?: unknown }).toArray === 'function'
    ? (v as { toArray(): unknown }).toArray()
    : v;

/** A comparable form of a result: BigNumbers and Fractions by their text, matrices as arrays. */
function ser(v: unknown): unknown {
  const a = toArr(v);
  if (Array.isArray(a)) return a.map(ser);
  if (a instanceof BigNumber) return 'BN:' + String(a);
  if (a !== null && typeof a === 'object') {
    const o = a as { type?: string; numerator?: bigint; denominator?: bigint };
    if (o.type === 'Fraction') return `Fraction:${o.numerator}/${o.denominator}`;
  }
  if (typeof a === 'number' && Object.is(a, -0)) return '-0';
  if (typeof a === 'bigint') return 'bigint:' + a;
  return a;
}

/** The outcome of an expression as a comparable value: a result or `THROW <class> <message>`. */
function outcome(run: () => unknown): unknown {
  try {
    return ser(run());
  } catch (e) {
    return `THROW ${(e as Error).constructor.name} ${(e as Error).message}`;
  }
}

const X = '987654321098765432109876';
const Y = '123456789012345';

afterEach(() => {
  BigNumber.resetConfig();
});

describe('#1164 integer functions of BigNumbers through the expression language', () => {
  it('#1164 xgcd of the issue operands is exact on both paths', () => {
    const e = `xgcd(bignumber("${X}"), bignumber("${Y}"))`;
    for (const res of [ev(e), toArr(pv(e))]) {
      expect((res as BigNumber[]).map(big)).toEqual([
        '3',
        '5330323120803',
        '-42642585355004793538465',
      ]);
    }
  });

  it('#1164 combinations(bignumber(200), bignumber(100)) is exact on both paths', () => {
    const exact = '90548514656103281165404177077484163874504589675413336841320';
    expect(big(ev('combinations(bignumber(200), bignumber(100))'))).toBe(exact);
    expect(big(pv('combinations(bignumber(200), bignumber(100))'))).toBe(exact);
  });

  it('#1164 isPrime of a BigNumber above 2^32', () => {
    expect(ev('isPrime(bignumber("1000000000000037"))')).toBe(true);
    expect(ev('isPrime(bignumber("170141183460469231731687303715884105727"))')).toBe(true);
    expect(ev('isPrime(bignumber("170141183460469231731687303715884105729"))')).toBe(false);
    expect(ev('isPrime(bignumber("3317044064679887385961981"))')).toBe(false);
  });

  it('#1164 xgcd(8, 12) is a matrix on the parse path and an Array in evaluate', () => {
    const parsed = pv('xgcd(8, 12)') as { isMatrix?: boolean; toArray(): number[] };
    expect(parsed.isMatrix).toBe(true);
    expect(parsed.toArray()).toEqual([4, -1, 1]);
    expect(ev('xgcd(8, 12)')).toEqual([4, -1, 1]);
  });

  it('#1164 invmod keeps its values after xgcd moved to one implementation', () => {
    expect(ev('invmod(3, 11)')).toBe(4);
    expect(ev('invmod(-3, 11)')).toBe(7);
    expect(ev('invmod(3, -11)')).toBe(-18);
    expect(pv('invmod(3, 11)')).toBe(4);
    expect(pv('invmod(-3, 11)')).toBe(7);
    expect(pv('invmod(3, -11)')).toBe(-18);
    for (const run of [ev, pv]) {
      expect(str(run('invmod(bignumber(3), bignumber(11))'))).toBe('4');
      expect(str(run('invmod(bignumber(-3), bignumber(11))'))).toBe('7');
      expect(str(run('invmod(bignumber(3), bignumber(-11))'))).toBe('-18');
    }
  });

  it('#1093 the dependents of combinations keep their values', () => {
    for (const run of [ev, pv]) {
      expect(run('catalan(5)')).toBe(42);
      expect(str(run('catalan(bignumber(30))'))).toBe('3814986502092304');
      expect(run('composition(5, 3)')).toBe(6);
      expect(str(run('composition(bignumber(5), bignumber(3))'))).toBe('6');
      expect(run('stirlingS2(5, 3)')).toBe(25);
      expect(str(run('stirlingS2(bignumber(50), bignumber(3))'))).toBe('119649664052358811373730');
      expect(str(run('bellNumbers(bignumber(30))'))).toBe('846749014511809332450147');
    }
  });
});

describe('#1097 integer functions through the expression language', () => {
  it('#1097 xgcd throws for NaN, a fraction and Infinity on both paths', () => {
    const msg = 'Parameters in function xgcd must be integer numbers';
    for (const e of [
      'xgcd(bignumber(NaN), 4)',
      'xgcd(bignumber("0.1"), 4)',
      'xgcd(0.1, 4)',
      'xgcd(NaN, 4)',
      'xgcd(Infinity, 4)',
    ]) {
      expect(() => ev(e), e).toThrow(msg);
      expect(() => pv(e), e).toThrow(msg);
    }
  });

  it('#1097 xgcd of mixed BigNumber and number gives BigNumbers', () => {
    for (const run of [ev, pv]) {
      expect((toArr(run('xgcd(bignumber(12), 8)')) as BigNumber[]).map(str)).toEqual([
        '4',
        '1',
        '-1',
      ]);
      expect((toArr(run('xgcd(8, bignumber(12))')) as BigNumber[]).map(str)).toEqual([
        '4',
        '-1',
        '1',
      ]);
    }
  });

  it('#1097 nthRoot of a negative BigNumber with an even root throws', () => {
    // `nthRoot` keeps two implementations (the factory one on the parse path), so only the
    // rows that both give the same way are pinned on both paths; the follow-up issue lists the rest.
    expect(() => ev('nthRoot(bignumber(-8), 2)')).toThrow('Root must be odd when a is negative.');
    expect(() => pv('nthRoot(bignumber(-8), 2)')).toThrow();
    for (const run of [ev, pv]) {
      expect(() => run('nthRoot(bignumber(-8), bignumber(2))')).toThrow(
        'Root must be odd when a is negative.'
      );
    }
    expect(str(ev('nthRoot(bignumber(-8), 3)'))).toBe('-2');
  });

  it('#1097 permutations of BigNumbers, with mathjs error texts', () => {
    for (const run of [ev, pv]) {
      expect(str(run('permutations(bignumber(10), bignumber(3))'))).toBe('720');
      expect(str(run('permutations(bignumber(10))'))).toBe('3628800');
      expect(() => run('permutations(bignumber(NaN), 2)')).toThrow(
        'Positive integer value expected in function permutations'
      );
      expect(() => run('permutations(-1, 2)')).toThrow(
        'Positive integer value expected in function permutations'
      );
      expect(() => run('permutations(bignumber(-1), 2)')).toThrow(
        'Positive integer value expected in function permutations'
      );
      expect(() => run('permutations(bignumber(2.5))')).toThrow('Integer BigNumber expected');
    }
  });

  it('#1097 permutations(170, 170) and permutations(170) are 170! (mathjs ...998e+306)', () => {
    for (const run of [ev, pv]) {
      expect(run('permutations(170, 170)')).toBe(7.257415615307998e306);
      expect(run('permutations(170)')).toBe(7.257415615307998e306);
      expect(run('permutations(200, 2)')).toBe(39800);
      expect(run('permutations(2^53 - 2, 2)')).toBe((2 ** 53 - 2) * (2 ** 53 - 3));
    }
  });

  it('#1097 permutations of collections on both paths', () => {
    for (const run of [ev, pv]) {
      expect(toArr(run('permutations([5, 6], 2)'))).toEqual([20, 30]);
      expect(toArr(run('permutations([5, 6])'))).toEqual([120, 720]);
      expect(toArr(run('permutations(5, [1, 2])'))).toEqual([5, 20]);
    }
  });
});

describe('#1097 mod of BigNumbers takes the sign of the divisor on both paths', () => {
  // Oracle: mathjs 15.2.0. `evaluate` ran the typed row, which gave the sign of the dividend.
  const ROWS: Array<[string, string]> = [
    ['mod(bignumber(-1), bignumber(5))', '4'],
    ['mod(bignumber(-7), bignumber(3))', '2'],
    ['mod(bignumber(7), bignumber(-3))', '-2'],
    ['mod(bignumber(-7), bignumber(-3))', '-1'],
    ['mod(-1, bignumber(5))', '4'],
    ['mod(bignumber(-1), 5)', '4'],
    ['mod(bignumber(-7.5), bignumber(2))', '0.5'],
    ['mod(bignumber(-1), bignumber(Infinity))', 'NaN'],
    ['mod(bignumber(1), bignumber(Infinity))', 'NaN'],
    ['mod(bignumber(-1), bignumber(-Infinity))', 'NaN'],
    ['mod(bignumber(Infinity), bignumber(5))', 'NaN'],
    ['mod(bignumber(NaN), bignumber(5))', 'NaN'],
    ['mod(bignumber(5), bignumber(NaN))', 'NaN'],
  ];
  for (const [e, want] of ROWS) {
    it(`#1097 ${e} = ${want} on evaluate and on parse`, () => {
      expect(str(ev(e)), 'evaluate').toBe(want);
      expect(str(pv(e)), 'parse').toBe(want);
    });
  }
});

describe('#1097 the bitwise operators of BigNumbers on both paths', () => {
  // Oracle: mathjs 15.2.0. The parse path ran helpers written for the digit array of decimal.js,
  // so a finite operand threw `Cannot read properties of undefined`, and `bitNot` kept the sign.
  const BIG = '"123456789012345678901234567890"';
  const ROWS: Array<[string, string]> = [
    ['bitAnd(bignumber(12), bignumber(10))', '8'],
    ['bitAnd(bignumber(-12), bignumber(3))', '0'],
    ['bitAnd(bignumber(12), 3)', '0'],
    ['bitAnd(12, bignumber(3))', '0'],
    ['bitAnd(bignumber(-5), bignumber(12))', '8'],
    ['bitOr(bignumber(12), bignumber(10))', '14'],
    ['bitOr(bignumber(-12), bignumber(3))', '-9'],
    ['bitOr(12, bignumber(3))', '15'],
    ['bitOr(bignumber(5), bignumber(-12))', '-11'],
    [`bitOr(bignumber(${BIG}), bignumber(5))`, '123456789012345678901234567895'],
    ['bitXor(bignumber(12), bignumber(10))', '6'],
    ['bitXor(bignumber(-12), bignumber(3))', '-9'],
    ['bitXor(bignumber(-5), bignumber(-12))', '15'],
    ['bitXor(bignumber(-1), bignumber(5))', '-6'],
    ['bitXor(bignumber(5), bignumber(-1))', '-6'],
    ['bitXor(bignumber(-1), bignumber(-5))', '4'],
    ['bitNot(bignumber(12))', '-13'],
    ['bitNot(bignumber(-12))', '11'],
    ['bitNot(bignumber(0))', '-1'],
    [`bitNot(bignumber(${BIG}))`, '-123456789012345678901234567891'],
  ];
  for (const [e, want] of ROWS) {
    it(`#1097 ${e} = ${want} on evaluate and on parse`, () => {
      expect(big(ev(e)), 'evaluate').toBe(want);
      expect(big(pv(e)), 'parse').toBe(want);
    });
  }

  it('#1097 the special cases of an infinite operand keep their values on the parse path', () => {
    expect(str(pv('bitNot(bignumber(Infinity))'))).toBe('-Infinity');
    expect(str(pv('bitNot(bignumber(-Infinity))'))).toBe('Infinity');
    expect(str(pv('bitXor(bignumber(-1), bignumber(Infinity))'))).toBe('-Infinity');
    expect(str(pv('bitAnd(bignumber(Infinity), bignumber(5))'))).toBe('5');
    expect(str(pv('bitOr(bignumber(5), bignumber(Infinity))'))).toBe('Infinity');
  });
});

describe('#1096 gcd and lcm of Fractions and of more than two values', () => {
  it('#1096 gcd and lcm of Fractions', () => {
    for (const run of [ev, pv]) {
      expect(ser(run('gcd(fraction(1, 2), fraction(1, 3))'))).toBe(ser(run('fraction(1, 6)')));
      expect(ser(run('lcm(fraction(1, 2), fraction(1, 3))'))).toBe(ser(run('fraction(1)')));
      expect(ser(run('gcd(fraction(1, 2), fraction(1, 3), fraction(1, 4))'))).toBe(
        ser(run('fraction(1, 12)'))
      );
      expect(ser(run('lcm(fraction(1, 2), fraction(1, 3), fraction(1, 4))'))).toBe(
        ser(run('fraction(1)'))
      );
    }
  });

  it('#1096 gcd and lcm of three or more integers (evaluate and parse agree)', () => {
    for (const run of [ev, pv]) {
      expect(run('gcd(25, 15, -10)')).toBe(5);
      expect(run('gcd(4, 6, 8)')).toBe(2);
      expect(run('lcm(4, 6, 8)')).toBe(24);
      expect(str(run('gcd(bignumber(4), bignumber(6), bignumber(8))'))).toBe('2');
      expect(str(run('lcm(bignumber(4), bignumber(6), bignumber(8))'))).toBe('24');
    }
  });
});

describe('#1093 multinomial through the expression language', () => {
  it('#1093 a matrix of arrays is a 2-D matrix on the parse path', () => {
    expect(pv('multinomial([[1, 2], [3, 4]])')).toBe(12600);
    expect(pv('sum([[1, 2], [3, 4]])')).toBe(10);
    expect((pv('[[1, 2], [3, 4]]') as { size(): number[] }).size()).toEqual([2, 2]);
    expect((pv('matrix([matrix([1, 2]), matrix([3, 4])])') as { size(): number[] }).size()).toEqual(
      [2, 2]
    );
  });

  it('#1093 multinomial of BigNumbers and booleans', () => {
    for (const run of [ev, pv]) {
      const r = run('multinomial([bignumber(2), bignumber(3)])');
      expect(r).toBeInstanceOf(BigNumber);
      expect(str(r)).toBe('10');
      expect(run('multinomial([true, true])')).toBe(2);
    }
  });

  it('#1093 multinomial of two BigNumbers of 20000 finishes (the issue said 19 s)', () => {
    BigNumber.config({ precision: 64 });
    const r = pv('multinomial([bignumber(20000), bignumber(20000)])') as BigNumber;
    expect(str(r).replace('.', '').slice(0, 59)).toBe(
      '63202449561848590095130949530177785527214289537290468238316'
    );
  });

  it('#1093 a ragged array literal: the parse path refuses the matrix, evaluate keeps the array', () => {
    // mathjs builds a matrix from the literal and throws a DimensionError. The compat evaluate
    // keeps a plain nested array, and multinomial counts all of its entries (1 + 2 + 3).
    expect(() => pv('multinomial([[1, 2], [3]])')).toThrow(/Dimension mismatch/);
    expect(ev('multinomial([[1, 2], [3]])')).toBe(60);
  });
});

describe('#1093 parse and evaluate run one implementation of the shared functions', () => {
  const ROWS = [
    // #1093, #1097, #1164 rows
    'multinomial([1, 2, 3])',
    'multinomial([[1, 2], [3, 4]])',
    'multinomial(matrix([1, 2, 3]))',
    'multinomial([bignumber(2), bignumber(3)])',
    'multinomial([true, true])',
    'multinomial([false, true])',
    'multinomial([1, 2.5])',
    'multinomial([0, 1])',
    'multinomial([1000, 1000])',
    'permutations([5, 6], 2)',
    'permutations([5, 6])',
    'permutations(5, [1, 2])',
    'permutations(170)',
    'permutations(170, 170)',
    'permutations(171)',
    'permutations(-1, 2)',
    'permutations(2.5, 1)',
    'permutations(5, 2.5)',
    'permutations(2, 5)',
    'permutations(7.5)',
    'permutations(bignumber(10), bignumber(3))',
    'permutations(bignumber(10), 3)',
    'permutations(10, bignumber(3))',
    'permutations(bignumber(10))',
    'permutations(bignumber(NaN), 2)',
    'permutations(bignumber(-1))',
    'permutations(bignumber(5), bignumber(6))',
    'permutations(200, 2)',
    'combinations(7, 5)',
    'combinations(2, 5)',
    'combinations(-1, 2)',
    'combinations(2.5, 1)',
    'combinations([5, 6], 2)',
    'combinations(5, [1, 2])',
    'combinations(bignumber(200), bignumber(100))',
    'combinations(bignumber(200), 100)',
    'combinations(200, bignumber(100))',
    'combinations(bignumber(2), bignumber(5))',
    'combinations(bignumber(5), bignumber(0))',
    'combinations(bignumber(-1), bignumber(2))',
    'combinations([bignumber(5), bignumber(6)], bignumber(2))',
    'combinationsWithRep(5, 3)',
    'combinationsWithRep(5, 0)',
    'combinationsWithRep(0, 3)',
    'combinationsWithRep(-1, 3)',
    'combinationsWithRep(5, 2.5)',
    'combinationsWithRep(1e20, 2)',
    'combinationsWithRep(bignumber(5), bignumber(3))',
    'combinationsWithRep(bignumber(300), bignumber(150))',
    'combinationsWithRep(bignumber(8), 3)',
    'combinationsWithRep(3, bignumber(8))',
    'combinationsWithRep(bignumber(0), bignumber(3))',
    'combinationsWithRep(bignumber(-1), bignumber(3))',
    'xgcd(8, 12)',
    'xgcd(-12, 8)',
    'xgcd(12, -8)',
    'xgcd(0, 0)',
    'xgcd(-7, 0)',
    'xgcd(0.1, 4)',
    'xgcd(NaN, 4)',
    'xgcd(Infinity, 4)',
    'xgcd(bignumber(12), 8)',
    'xgcd(bignumber(12), bignumber(-8))',
    `xgcd(bignumber("${X}"), bignumber("${Y}"))`,
    'xgcd(bignumber(NaN), 4)',
    'xgcd(fraction(12), fraction(8))',
    // section 0.1: rows where the factory and the typed function differed
    'combinations(200, 100)',
    'combinations(200, 171)',
    'combinations(1e20, 2)',
    'combinations(2^53, 3)',
    'permutations(1e20, 2)',
    'permutations(2^53, 2)',
    'xgcd(2^60, 3)',
    'combinations(fraction(5), fraction(2))',
    'permutations(fraction(5), fraction(2))',
    'permutations(fraction(5))',
    'combinations(5, 2, 1)',
    'combinations(5)',
    'permutations()',
  ];

  for (const e of ROWS) {
    it(`#1093 parse and evaluate agree on ${e}`, () => {
      expect(outcome(() => pv(e))).toEqual(outcome(() => ev(e)));
    });
  }

  it('#1093 the accepted changes of the parse path (named in the pull request)', () => {
    // Correctly rounded values in place of the last-digit errors of the mathjs loop.
    expect(pv('combinations(200, 100)')).toBe(9.054851465610328e58);
    expect(pv('combinations(200, 171)')).toBe(7.187398333721542e34);
    // A value in place of the RangeError of the factory.
    expect(pv('combinations(1e20, 2)')).toBe(5e39);
    expect(pv('permutations(1e20, 2)')).toBe(1e40);
    expect(pv('permutations(2^53, 2)')).toBe(8.112963841460667e31);
    // The exact result above 2^53.
    expect(toArr(pv('xgcd(2^60, 3)'))).toEqual([1, 1, -384307168202282300]);
    // A Fraction is read as a number (mathjs throws a conversion error; the factory gave a BigNumber).
    expect(pv('combinations(fraction(5), fraction(2))')).toBe(10);
    expect(pv('permutations(fraction(5))')).toBe(120);
  });
});
