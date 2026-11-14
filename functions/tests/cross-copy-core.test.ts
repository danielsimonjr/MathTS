/**
 * A value from a second copy of `@danielsimonjr/mathts-core` must work in typed dispatch (#1033).
 *
 * Two copies of core load when a package manager fails to dedupe, or when a test runner inlines
 * one path and externalizes another. Each copy has its own `Complex`, `Fraction`, `BigNumber` and
 * `Dual` classes, so `instanceof` fails across the copies. The tests load a real second copy with
 * `vi.resetModules()` and run values of that copy through the public functions of the first copy.
 *
 * The operands are large enough that a wrong code path shows in the result: a `Fraction`
 * denominator above 2^53 and a 31-digit `BigNumber` do not survive `Number(other.valueOf())`, and
 * the magnitude that `Complex.valueOf()` returns does not equal either part of the value.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as core1 from '@danielsimonjr/mathts-core';
import { add, divide, multiply, subtract, zpk2sos } from '../src/index.js';
import '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';

type Core = typeof core1;

let core2: Core;

beforeAll(async () => {
  vi.resetModules();
  core2 = (await import('@danielsimonjr/mathts-core')) as Core;
});

/** Read the parts of a Complex result without a class check: the result can come from either copy. */
function parts(value: unknown): [number, number] {
  const z = value as { re: number; im: number };
  return [z.re, z.im];
}

/** Read an exact Fraction result without a class check. */
function ratio(value: unknown): [bigint, bigint] {
  const f = value as { numerator: bigint; denominator: bigint };
  return [f.numerator, f.denominator];
}

const TWO_POW_60 = 2n ** 60n;

describe('the second copy of core is a real second copy', () => {
  it('has its own classes', () => {
    expect(core2.Complex).not.toBe(core1.Complex);
    expect(core2.Fraction).not.toBe(core1.Fraction);
    expect(core2.BigNumber).not.toBe(core1.BigNumber);
    expect(core2.Dual).not.toBe(core1.Dual);
    expect(new core2.Complex(3, 4) instanceof core1.Complex).toBe(false);
  });

  it('passes the type tests of the first copy', () => {
    expect(core1.isComplex(new core2.Complex(3, 4))).toBe(true);
    expect(core1.isFraction(new core2.Fraction(1, 3))).toBe(true);
    expect(core1.isBigNumber(new core2.BigNumber('1.5'))).toBe(true);
    expect(core1.isDual(new core2.Dual(1, 1))).toBe(true);
  });
});

describe('Complex of a second copy', () => {
  it('works in typed add, subtract, multiply and divide, in both operand orders', () => {
    const own = new core1.Complex(1, 2);
    const foreign = new core2.Complex(3, 4);
    expect(parts(add(own, foreign))).toEqual([4, 6]);
    expect(parts(add(foreign, own))).toEqual([4, 6]);
    expect(parts(subtract(own, foreign))).toEqual([-2, -2]);
    expect(parts(subtract(foreign, own))).toEqual([2, 2]);
    expect(parts(multiply(own, foreign))).toEqual([-5, 10]);
    expect(parts(multiply(foreign, own))).toEqual([-5, 10]);
    expect(parts(divide(foreign, new core1.Complex(0, 1)))).toEqual([4, -3]);
    expect(parts(divide(own, foreign))).toEqual([11 / 25, 2 / 25]);
  });

  it('works with a number operand', () => {
    const foreign = new core2.Complex(3, 4);
    expect(parts(add(foreign, 1))).toEqual([4, 4]);
    expect(parts(add(1, foreign))).toEqual([4, 4]);
    expect(parts(multiply(2, foreign))).toEqual([6, 8]);
  });

  it('works as the operand of the methods of the first copy', () => {
    const own = new core1.Complex(1, 2);
    const foreign = new core2.Complex(3, 4);
    expect(parts(own.add(foreign))).toEqual([4, 6]);
    expect(parts(own.subtract(foreign))).toEqual([-2, -2]);
    expect(parts(own.multiply(foreign))).toEqual([-5, 10]);
    expect(parts(own.divide(foreign))).toEqual([11 / 25, 2 / 25]);
  });

  it('works in the polymorphic scalar operations of core', () => {
    const own = new core1.Complex(1, 2);
    const foreign = new core2.Complex(3, 4);
    expect(parts(core1.addScalar(own, foreign))).toEqual([4, 6]);
    expect(parts(core1.multiplyScalar(foreign, own))).toEqual([-5, 10]);
    expect(parts(core1.addScalar(foreign, 1))).toEqual([4, 4]);
    expect(core1.equal(own, new core2.Complex(1, 2))).toBe(true);
  });
});

describe('Fraction of a second copy', () => {
  it('keeps every digit in typed add and multiply', () => {
    const own = new core1.Fraction(1n, 3n);
    const foreign = new core2.Fraction(1n, TWO_POW_60);
    expect(ratio(add(own, foreign))).toEqual([TWO_POW_60 + 3n, 3n * TWO_POW_60]);
    expect(ratio(add(foreign, own))).toEqual([TWO_POW_60 + 3n, 3n * TWO_POW_60]);
    expect(ratio(multiply(own, foreign))).toEqual([1n, 3n * TWO_POW_60]);
  });

  it('keeps every digit as the operand of the methods of the first copy', () => {
    const own = new core1.Fraction(1n, 3n);
    const foreign = new core2.Fraction(1n, TWO_POW_60);
    expect(ratio(own.add(foreign))).toEqual([TWO_POW_60 + 3n, 3n * TWO_POW_60]);
    expect(ratio(own.subtract(foreign))).toEqual([TWO_POW_60 - 3n, 3n * TWO_POW_60]);
    expect(ratio(own.multiply(foreign))).toEqual([1n, 3n * TWO_POW_60]);
    expect(ratio(own.divide(foreign))).toEqual([TWO_POW_60, 3n]);
  });

  it('keeps every digit in the polymorphic scalar operations of core', () => {
    const own = new core1.Fraction(1n, 3n);
    const foreign = new core2.Fraction(1n, TWO_POW_60);
    expect(ratio(core1.addScalar(own, foreign))).toEqual([TWO_POW_60 + 3n, 3n * TWO_POW_60]);
    expect(core1.equal(foreign, new core2.Fraction(1n, TWO_POW_60))).toBe(true);
  });
});

describe('BigNumber of a second copy', () => {
  const ONE = '1.000000000000000000000000000001';
  const TWO = '2.000000000000000000000000000001';

  it('keeps every digit in typed add and multiply', () => {
    const own = new core1.BigNumber(ONE);
    const foreign = new core2.BigNumber(TWO);
    expect(String(add(own, foreign))).toBe('3.000000000000000000000000000002');
    expect(String(add(foreign, own))).toBe('3.000000000000000000000000000002');
    expect(String(multiply(own, foreign))).toBe(String(own.multiply(new core1.BigNumber(TWO))));
  });

  it('keeps every digit as the operand of the methods of the first copy', () => {
    const own = new core1.BigNumber(ONE);
    const foreign = new core2.BigNumber(TWO);
    expect(String(own.add(foreign))).toBe('3.000000000000000000000000000002');
    expect(String(own.subtract(foreign))).toBe('-1');
    expect(new core1.BigNumber(foreign).toString()).toBe(TWO);
    expect(core1.BigNumber.from(foreign).toString()).toBe(TWO);
  });

  it('keeps every digit in the polymorphic scalar operations of core', () => {
    const own = new core1.BigNumber(ONE);
    const foreign = new core2.BigNumber(TWO);
    expect(String(core1.addScalar(own, foreign))).toBe('3.000000000000000000000000000002');
    expect(core1.equal(foreign, new core2.BigNumber(TWO))).toBe(true);
  });
});

describe('Dual of a second copy', () => {
  it('passes the guard of typed add', () => {
    const own = new core1.Dual(1, 1);
    const foreign = new core2.Dual(2, 1);
    const sum = add(own, foreign) as { value: number; deriv: number };
    expect([sum.value, sum.deriv]).toEqual([3, 2]);
  });
});

describe('the pinv call of the issue', () => {
  it('gives the same result for a Complex of a second copy', () => {
    const pinv = factoryScope.pinv as (m: unknown) => unknown;
    const own = pinv([
      [new core1.Complex(1, 1), 2],
      [3, 4],
    ]);
    const foreign = pinv([
      [new core2.Complex(1, 1), 2],
      [3, 4],
    ]);
    expect(JSON.stringify(foreign)).toBe(JSON.stringify(own));
    const first = (foreign as { re: number; im: number }[][])[0]?.[0];
    expect([first?.re, first?.im]).toEqual([-0.4, -0.8]);
  });
});

describe('an object with only a mathjs-style marker is not a core value', () => {
  // The prototype of a mathjs Fraction has `isFraction === true`, and its fields are `s`, `n` and
  // `d`. Core reads `numerator` and `denominator`, so it must not accept such an object.
  class MathjsFraction {
    constructor(
      readonly s: number,
      readonly n: number,
      readonly d: number
    ) {}
  }
  Object.defineProperty(MathjsFraction.prototype, 'isFraction', { value: true });
  class MathjsBigNumber {}
  Object.defineProperty(MathjsBigNumber.prototype, 'isBigNumber', { value: true });

  it('fails the type tests of core', () => {
    expect(core1.isFraction(new MathjsFraction(1, 1, 3))).toBe(false);
    expect(core1.isBigNumber(new MathjsBigNumber())).toBe(false);
  });

  it('is rejected by typed add', () => {
    expect(() => add(new core1.Fraction(1n, 3n), new MathjsFraction(1, 1, 3))).toThrow(TypeError);
    expect(() => add(new core1.BigNumber('1'), new MathjsBigNumber())).toThrow(TypeError);
  });
});

describe('signal design with roots of a second copy', () => {
  it('zpk2sos reads the parts of the poles of either copy', () => {
    const p1 = [new core1.Complex(0.5, 0.25), new core1.Complex(0.5, -0.25)];
    const p2 = [new core2.Complex(0.5, 0.25), new core2.Complex(0.5, -0.25)];
    // The poles 0.5 +- 0.25i give the denominator z^2 - 1.0 z + 0.3125. A pole read as its
    // magnitude 0.559 gives -1.118 for the middle coefficient.
    for (const p of [p1, p2]) {
      const [[b0, b1, b2, a0, a1, a2]] = zpk2sos([], p as never, 1);
      expect([b0, b1, b2, a0]).toEqual([1, 0, 0, 1]);
      expect(a1).toBeCloseTo(-1, 12);
      expect(a2).toBeCloseTo(0.3125, 12);
    }
  });
});

describe('relational, string and scope functions with values of a second copy', () => {
  const A = '1.000000000000000000000000000002';
  const B = '1.000000000000000000000000000001';

  it('compareNatural orders BigNumbers that differ in the last digit', async () => {
    const { compareNatural } = await import('../src/typed/relational.js');
    expect(compareNatural(new core2.BigNumber(A), new core2.BigNumber(B))).toBe(1);
    expect(compareNatural(new core1.BigNumber(B), new core1.BigNumber(A))).toBe(-1);
  });

  it('compareNatural orders Fractions that differ past 2^53', async () => {
    const { compareNatural } = await import('../src/typed/relational.js');
    const big = new core2.Fraction(TWO_POW_60 + 1n, TWO_POW_60);
    const small = new core2.Fraction(TWO_POW_60, TWO_POW_60 + 1n);
    expect(compareNatural(big, small)).toBe(1);
  });

  it('compareNatural orders Complex values by their parts', async () => {
    const { compareNatural } = await import('../src/typed/relational.js');
    expect(compareNatural(new core2.Complex(1, 2), new core2.Complex(1, 3))).toBe(-1);
  });

  it('format writes every digit of a BigNumber', async () => {
    const { format } = await import('../src/typed/string.js');
    expect(format(new core2.BigNumber(A))).toBe(A);
    expect(format(new core2.BigNumber('Infinity'))).toBe('Infinity');
    expect(format(new core2.BigNumber(A), 3)).toBe('1.00');
  });

  it('the bignumber of the factory scope keeps every digit', () => {
    const bn = (factoryScope as unknown as { bignumber(x: unknown): unknown }).bignumber(
      new core2.BigNumber(A)
    );
    expect(String(bn)).toBe(A);
  });

  it('sum rejects the imaginary unit of a second copy as a dummy index', async () => {
    const { rejectMisusedIndexedSum } = await import('../src/statistics/sum-indexed-guard.js');
    const i = new core2.Complex(0, 1);
    expect(() => rejectMisusedIndexedSum([i, 1, 3, i])).toThrow(/imaginary unit/);
  });

  it('a dimension vector of Fractions of a second copy is valid', async () => {
    const { validateDimensionVector } = await import('../src/scalar-dimension.js');
    const v = Array.from({ length: core1.SI_DIMENSION_LENGTH }, () => new core2.Fraction(0, 1));
    expect(v).toHaveLength(7);
    expect(() => validateDimensionVector(v as never)).not.toThrow();
  });
});
