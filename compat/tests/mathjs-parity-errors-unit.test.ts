import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { Fraction } from '@danielsimonjr/mathts-core';
import {
  createCompatNumeric,
  createCompatRandomInstance,
  remapPublicScalarFnName,
  withCompatBitNotInfiniteBigNumber,
  withCompatBitShiftBigNumberParity,
  withCompatBitwiseInfiniteBigNumberBinary,
  withMathjsNormMatrixRules,
  withMatrixMapHintOnUnary,
  withPublicFactoryScalar,
} from '../src/mathjs-parity-errors.js';

describe('mathjs-parity-errors adapters', () => {
  it('remapPublicScalarFnName rewrites factory names in messages', () => {
    const msg = 'Unexpected type in function addScalar (index: 0)';
    expect(remapPublicScalarFnName(msg, 'addScalar', 'add')).toContain('function add');
  });

  it('withPublicFactoryScalar remaps TypeErrors and fraction guards', () => {
    const throwsMatrix = (..._args: unknown[]) => {
      throw new TypeError(
        'Unexpected type of argument in function addScalar (expected: number, actual: Matrix, index: 0)'
      );
    };
    const add = withPublicFactoryScalar('add', 'addScalar', throwsMatrix, {
      guardFractionBigNumber: true,
    });
    expect(() => add({ isMatrix: true }, 1)).toThrow(/function add/);
    const instance = create(all);
    expect(() => add(instance.fraction(1, 2), instance.bignumber(1))).toThrow(/implicitly/);
    const syntaxFail = (..._args: unknown[]) => {
      throw new SyntaxError('Cannot parse BigNumber');
    };
    const add2 = withPublicFactoryScalar('add', 'addScalar', syntaxFail);
    expect(() => add2('nope', 1)).toThrow(/Cannot convert/);
  });

  it('withMatrixMapHintOnUnary suggests map() for matrix callbacks', () => {
    const fn = withMatrixMapHintOnUnary('square', () => 0);
    const instance = create(all);
    expect(() => fn(instance.matrix([1, 2]))).toThrow(/map\(/);
    expect(fn(2)).toBe(0);
  });

  it('bitwise and norm wrappers match mathjs edge messages', () => {
    const instance = create(all);
    const inf = instance.bignumber(Infinity);
    const bitAnd = withCompatBitwiseInfiniteBigNumberBinary(
      instance.bitAnd.bind(instance),
      'and'
    );
    expect(() => bitAnd(inf, 'x')).toThrow();
    const bitNot = withCompatBitNotInfiniteBigNumber(instance.bitNot.bind(instance));
    expect(bitNot(inf)).toBeDefined();
    const shift = withCompatBitShiftBigNumberParity(instance.leftShift.bind(instance));
    expect(String(shift(inf, -1))).toMatch(/NaN|Infinity/);
    const norm = withMathjsNormMatrixRules(instance.norm.bind(instance));
    expect(norm(instance.matrix([1, 2]))).toBeDefined();
  });

  it('numeric and random instance helpers forward to mathjs factories', () => {
    const instance = create(all);
    const num = createCompatNumeric((value: unknown, outputType?: unknown) => {
      if (outputType === 'Fraction') return new Fraction(1, 2);
      if (value === 'not-a-number') return NaN;
      return Number(value);
    });
    expect(num('1/2', 'Fraction')).toBeDefined();
    expect(() => num('not-a-number')).toThrow();
    const rnd = createCompatRandomInstance(instance.random.bind(instance));
    expect(typeof rnd()).toBe('number');
    expect(() => rnd(1, 2)).not.toThrow();
  });
});