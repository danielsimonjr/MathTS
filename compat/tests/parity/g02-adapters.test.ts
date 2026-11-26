import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { Fraction, Complex, BigNumber } from '@danielsimonjr/mathts-core';
import {
  createCompatArg,
  createCompatErfExpression,
  createCompatMad,
  createCompatVarargsStatistics,
  createForeignScalarConverter,
  isBigNumberLike,
  isComplexLike,
  isFractionLike,
  isMatrixLikeValue,
  isOwnBigNumber,
  withConvertedScalars,
  withCountBoolean,
  withFixedArity,
  withFractionRejection,
  withIdentityValidation,
  withRawSingleValue,
  withRoundDigitsGuard,
  FRACTION_TO_BIGNUMBER_ERROR,
} from '../../src/mathjs-parity-g02.js';

/**
 * Unit tests for the G02 compat adapters themselves (the differential behavior
 * against the mathjs 15.3.0 oracle lives in g02-factories.test.ts). The
 * adapters are pure wrappers, so stub delegates cover their branching.
 */

const identity = (x: unknown): unknown => x;
const instance = createCompat(compatAll, {});
const oracle = create(all, {});
const first = (...args: unknown[]): unknown => args[0];
const join = (...args: unknown[]): string => args.map(String).join('|');

describe('G02 duck-typed predicates', () => {
  it('isFractionLike: compat instance, foreign fraction.js, and non-fractions', () => {
    expect(isFractionLike(new Fraction(1n, 3n))).toBe(true);
    const foreign = create(all, {}).fraction(1, 3) as unknown as Record<string, unknown>;
    expect(isFractionLike(foreign)).toBe(true);
    expect(isFractionLike(null)).toBe(false);
    expect(isFractionLike(0.5)).toBe(false);
    expect(isFractionLike({ s: 1n, n: 1n, d: 0n })).toBe(false);
    expect(isFractionLike(new Complex(1, 2))).toBe(false);
  });

  it('isBigNumberLike: foreign decimal vs the compat class', () => {
    const foreign = create(all, {}).bignumber(2) as unknown as Record<string, unknown>;
    expect(isBigNumberLike(foreign)).toBe(true);
    expect(isOwnBigNumber(foreign)).toBe(false);
    expect(isOwnBigNumber(new BigNumber(2))).toBe(true);
    expect(isBigNumberLike(new BigNumber(2))).toBe(false);
    expect(isBigNumberLike(null)).toBe(false);
    expect(isBigNumberLike({ constructor: { name: 'Decimal' } })).toBe(false);
  });

  it('isComplexLike and isMatrixLikeValue', () => {
    expect(isComplexLike(new Complex(1, 2))).toBe(true);
    expect(isComplexLike({ re: 1, im: 2 })).toBe(true);
    expect(isComplexLike(null)).toBe(false);
    expect(isComplexLike({ re: 'x', im: 2 })).toBe(false);
    expect(isMatrixLikeValue([1, 2])).toBe(true);
    expect(isMatrixLikeValue(instance.matrix([1, 2]))).toBe(true);
    expect(isMatrixLikeValue(null)).toBe(false);
    expect(isMatrixLikeValue(5)).toBe(false);
  });
});

describe('G02 foreign-scalar converter', () => {
  const convert = createForeignScalarConverter({
    FractionClass: Fraction,
    BigNumberClass: BigNumber,
    ComplexClass: Complex,
    denseFrom: (nested) => (instance.matrix as (n: unknown) => unknown)(nested),
    sparseFrom: (nested) => (instance.matrix as (n: unknown) => unknown)(nested),
    isOwnMatrix: (x) =>
      typeof x === 'object' &&
      x !== null &&
      Object.getPrototypeOf(x) === Object.getPrototypeOf(instance.matrix([1])),
  });

  it('converts a foreign decimal and fraction, negative sign included', () => {
    const lib = create(all, {});
    const bn = convert(lib.bignumber('2.5')) as BigNumber;
    expect(bn.isBigNumber).toBe(true);
    expect(bn.toString()).toBe('2.5');
    const fpos = convert(lib.fraction(1, 3)) as Fraction;
    expect(fpos.numerator).toBe(1n);
    const fneg = convert(lib.fraction(-1, 3)) as Fraction;
    expect(fneg.numerator).toBe(-1n);
    expect(fneg.denominator).toBe(3n);
  });

  it('maps arrays, converts foreign complexes, and passes everything else through', () => {
    const lib = instance;
    const arr = convert([lib.bignumber(1), 2]) as unknown[];
    expect((arr[0] as BigNumber).isBigNumber).toBe(true);
    expect(arr[1]).toBe(2);
    const foreignComplex = lib.complex(1, 2) as unknown as { isComplex?: boolean };
    const c = convert(foreignComplex) as Complex;
    expect(c).toBeInstanceOf(Complex);
    expect(c.re).toBe(1);
    expect(convert(new Complex(1, 2))).toBeInstanceOf(Complex);
    expect(convert('abc')).toBe('abc');
    expect(convert(7)).toBe(7);
    const ownMatrix = instance.matrix([1]) as object;
    expect(convert(ownMatrix)).toBe(ownMatrix);
    // a foreign matrix becomes the compat bridge matrix of the same kind
    const foreignMatrix = oracle.matrix([1, 2]) as object;
    const dense = convert(foreignMatrix) as object;
    expect(dense).not.toBe(foreignMatrix);
    expect(Object.getPrototypeOf(dense)).toBe(
      Object.getPrototypeOf(instance.matrix([1]) as object)
    );
  });
});

describe('G02 wrapper primitives', () => {
  it('keepSurface copies name, length and signatures onto the wrapper', () => {
    const typed = withFractionRejection(first) as unknown as Record<string, unknown>;
    expect(typed.name).toBe('first');
    expect((typed.length as number) === 0 || (typed.length as number) === 1).toBe(true);
  });

  it('withFixedArity throws the mathjs too-many error at every other arity', () => {
    const one = withFixedArity('size', 1, identity);
    expect(one(5)).toBe(5);
    expect(() => one(2, 3)).toThrow('Too many arguments in function size (expected: 1, actual: 2)');
  });

  it('withFractionRejection rejects any Fraction argument with the mathjs error', () => {
    const guarded = withFractionRejection(join);
    expect(guarded(1, 2)).toBe('1|2');
    expect(() => guarded(new Fraction(1n, 3n))).toThrow(FRACTION_TO_BIGNUMBER_ERROR);
    expect(() => guarded(1, new Fraction(1n, 3n))).toThrow(FRACTION_TO_BIGNUMBER_ERROR);
  });

  it('keepSurface survives a frozen (surface-refusing) delegate', () => {
    const exotic = Object.freeze(function demo(...args: unknown[]): unknown {
      return args.length;
    });
    const guarded = withFractionRejection(exotic);
    expect(guarded(1, 2)).toBe(2);
    expect(() => guarded(new Fraction(1n, 3n))).toThrow(FRACTION_TO_BIGNUMBER_ERROR);
  });

  it('withCountBoolean converts a lone boolean to its string', () => {
    const count = withCountBoolean(join);
    expect(count(true)).toBe('true');
    expect(count('abcd')).toBe('abcd');
    expect(count(false, 1)).toBe('false|1');
  });

  it('withRawSingleValue passes a lone boolean or complex-like value through', () => {
    const raw = withRawSingleValue(join, isComplexLike);
    expect(raw(true)).toBe(true);
    expect(raw(new Complex(1, 2))).toBeInstanceOf(Complex);
    expect(raw(1, 2)).toBe('1|2');
  });

  it('withConvertedScalars converts every argument, arrays elementwise', () => {
    const lib = create(all, {});
    const conv = createForeignScalarConverter({
      FractionClass: Fraction,
      BigNumberClass: BigNumber,
      ComplexClass: Complex,
      denseFrom: (n) => n,
      sparseFrom: (n) => n,
      isOwnMatrix: () => false,
    });
    const wrapped = withConvertedScalars(conv, join);
    expect(wrapped(1, lib.bignumber(2))).toBe('1|2');
  });

  it('withRoundDigitsGuard rejects negative integer digit counts per type', () => {
    const round = withRoundDigitsGuard(join);
    expect(() => round(new BigNumber(2), -3)).toThrow('[DecimalError] Invalid argument: -3');
    expect(() => round(new Fraction(1n, 3n), -3)).toThrow('undefined must be positive');
    // a non-integer count keeps the native validation error
    expect(round(new BigNumber(2), -0.5)).toBe('2|-0.5');
    // non-numeric operands pass through
    expect(round(2, -3)).toBe('2|-3');
  });

  it('withIdentityValidation checks only the size-taking signature shapes', () => {
    const ident = withIdentityValidation(join);
    expect(() => ident(0)).toThrow('Parameters in function identity must be positive integers');
    expect(() => ident(2.5)).toThrow('Parameters in function identity must be positive integers');
    expect(() => ident(true, 0)).toThrow(
      'Parameters in function identity must be positive integers'
    );
    expect(() => ident([0, 3])).toThrow(
      'Parameters in function identity must be positive integers'
    );
    expect(() => ident(2, 0, 'dense')).toThrow(
      'Parameters in function identity must be positive integers'
    );
    // numeric strings and bigints convert before the check
    expect(() => ident('2', 0)).toThrow(
      'Parameters in function identity must be positive integers'
    );
    expect(() => ident(2n, 0)).toThrow('Parameters in function identity must be positive integers');
    // BigNumbers convert through toNumber
    expect(ident(new BigNumber(2), 'dense')).toBe('2|dense');
    expect(() => ident(new BigNumber(0.5))).toThrow(
      'Parameters in function identity must be positive integers'
    );
    // a matrix size argument is a matched shape
    expect(ident(instance.matrix([2, 3]))).toBeDefined();
    // passing shapes delegate
    expect(ident()).toBe('');
    expect(ident(2, 'dense')).toBe('2|dense');
    expect(ident(2, 3)).toBe('2|3');
    expect(ident([2, 3])).toBe('2,3');
    // an unmatched shape skips validation (the native typed error decides)
    expect(ident(new Complex(1, 2), 0)).toBe('1 + 2i|0');
  });

  it('createCompatErfExpression rejects a BigNumber with the mathjs message', () => {
    const erf = createCompatErfExpression(join);
    expect(erf(0.5)).toBe('0.5');
    expect(() => erf(new BigNumber(2))).toThrow(
      'Unexpected type of argument in function name ' +
        '(expected: number or Array or Matrix or bigint or string or boolean, ' +
        'actual: BigNumber, index: 0)'
    );
  });

  it('createCompatArg returns 0 or pi for a real BigNumber', () => {
    const arg = createCompatArg(join, BigNumber);
    expect((arg(new BigNumber(2)) as BigNumber).toString()).toBe('0');
    expect((arg(new BigNumber(-2)) as BigNumber).toNumber()).toBeCloseTo(Math.PI, 9);
    expect(arg(1, 2)).toBe('1|2');
  });
});

describe('G02 compat mad internals', () => {
  const N = (v: unknown): number =>
    typeof v === 'object' && v !== null
      ? Number((v as { valueOf(): unknown }).valueOf())
      : Number(v);
  const mad = createCompatMad({
    subtract: (a: unknown, b: unknown) => N(a) - N(b),
    abs: (x: unknown) => Math.abs(N(x)),
    add: (a: unknown, b: unknown) => N(a) + N(b),
    divide: (a: unknown, b: unknown) => N(a) / N(b),
    compare: (a: unknown, b: unknown) => N(a) - N(b),
    unaryPlus: (x: unknown) => x,
    convert: identity,
  });

  it('computes over arrays, keeps matrices whole, and throws on empty and NaN', () => {
    expect(mad(1, 2, 3)).toBe(1);
    expect(mad([1, 2, 3])).toBe(1);
    // a single matrix argument flattens through its own toArray
    const lib = instance;
    expect(mad(lib.matrix([1, 2]))).toBeCloseTo(0.5, 12);
    expect(() => mad([])).toThrow(
      'Cannot calculate median absolute deviation (mad) of an empty array'
    );
    expect(mad(NaN)).toBeNaN();
  });

  it('normalizes strings and mixed bigints to numbers', () => {
    // a numeric string converts; a non-numeric one throws the mathjs Error
    expect(mad('2', 0)).toBe(1);
    expect(() => mad('abc', 0)).toThrow('Cannot convert "abc" to a number');
    expect(mad(2n, 0)).toBe(1);
    // a null element does not pull the list into numbers
    expect(mad(2n, null)).toBe(1);
    // the stub arithmetic halves the sum; the real bigint behavior is pinned
    // differentially in g02-factories.test.ts
    expect(mad(2n, 3n)).toBe(0.5);
  });

  it('maps a median TypeError to mad', () => {
    const renaming = createCompatMad({
      subtract: () => {
        throw new TypeError('Cannot calculate median of an empty array');
      },
      abs: identity,
      add: identity,
      divide: identity,
      compare: () => 0,
      unaryPlus: identity,
      convert: identity,
    });
    try {
      renaming(1, 2);
      expect.unreachable();
    } catch (e) {
      expect((e as TypeError).message.startsWith('Cannot calculate mad')).toBe(true);
    }
    const rethrow = createCompatMad({
      subtract: () => {
        throw new RangeError('other');
      },
      abs: identity,
      add: identity,
      divide: identity,
      compare: () => 0,
      unaryPlus: identity,
      convert: identity,
    });
    expect(() => rethrow(1, 2)).toThrow('other');
  });
});

describe('G02 compat varargs statistics dispatch', () => {
  const calls: string[] = [];
  const native = (...args: unknown[]): string => {
    calls.push(JSON.stringify(args));
    return 'called';
  };
  const stat = createCompatVarargsStatistics(native);
  const matrixLike = Object.create({ isMatrix: true, toString: () => 'M' }) as object;

  it('routes the signature forms to the native signatures and the rest to the list', () => {
    stat(matrixLike);
    stat(matrixLike, 'unbiased');
    stat(matrixLike, 1);
    stat(matrixLike, 1, 'biased');
    stat(matrixLike, matrixLike);
    stat(1, 2, 3);
    expect(calls).toEqual([
      '[{}]',
      '[{},"unbiased"]',
      '[{},1]',
      '[{},1,"biased"]',
      '[[{},{}]]',
      '[1,2,3]',
    ]);
  });
});
