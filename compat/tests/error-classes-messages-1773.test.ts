/**
 * #1773: compat error classes and message text match mathjs 15.3.0 for the
 * redirected unit-test scenarios (add/null, arity, matrix map hints, …).
 */
import { describe, expect, it } from 'vitest';
import { create as createOracle, all as oracleAll, type MathJsInstance } from 'mathjs';
import { create, all, ArgumentsError, DimensionError, IndexError } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const compat = create(all) as unknown as Record<string, Fn> & MathJsInstance;
const oracle = createOracle(oracleAll) as unknown as Record<string, Fn> & MathJsInstance;

function oracleThrow(fn: Fn, ...args: unknown[]): { name: string; message: string } {
  try {
    fn(...args);
    throw new Error('expected throw');
  } catch (error) {
    return { name: (error as Error).name, message: (error as Error).message };
  }
}

function compatThrow(fn: Fn, ...args: unknown[]): { name: string; message: string } {
  try {
    fn(...args);
    throw new Error('expected throw');
  } catch (error) {
    return { name: (error as Error).name, message: (error as Error).message };
  }
}

function expectSameThrow(fn: Fn, oracleFn: Fn, ...args: unknown[]): void {
  const o = oracleThrow(oracleFn, ...args);
  const c = compatThrow(fn, ...args);
  expect(c.name).toBe(o.name);
  expect(c.message).toBe(o.message);
}

describe('#1773 error class exports', () => {
  it('re-exports mathjs error constructors', () => {
    expect(ArgumentsError.name).toBe('ArgumentsError');
    expect(DimensionError.name).toBe('DimensionError');
    expect(IndexError.name).toBe('IndexError');
    expect(new ArgumentsError('test')).toBeInstanceOf(Error);
  });
});

describe('#1773 scalar and arity messages', () => {
  it('add(null, 1) throws typed-function style error', () => {
    expect(() => compat.add(null, 1)).toThrow(TypeError);
    expect(() => compat.add(null, 1)).toThrow(/Unexpected type of argument in function add/);
  });

  it('bitAnd arity rejects with Too many arguments', () => {
    expectSameThrow(compat.bitAnd, oracle.bitAnd, 1, 2, 3);
  });

  it('dotMultiply arity rejects with Too few arguments', () => {
    expect(() => compat.dotMultiply(1)).toThrow(TypeError);
    expect(() => compat.dotMultiply(1)).toThrow(/Too few arguments in function dotMultiply/);
  });

  it('typeOf arity rejects with Too many arguments', () => {
    expectSameThrow(compat.typeOf, oracle.typeOf, 1, 2);
  });
});

describe('#1773 conversion and unit errors', () => {
  it('add string + BigNumber rejects invalid string like mathjs', () => {
    const bn = compat.bignumber(1);
    expect(() => compat.add('foo', bn)).toThrow(Error);
    expect(() => compat.add('foo', bn)).toThrow(/Cannot convert "foo" to BigNumber/);
    expect(() => oracle.add('foo', oracle.bignumber(1))).toThrow(
      /Cannot convert "foo" to BigNumber/
    );
    expectSameThrow(compat.add, oracle.add, 'foo', bn);
  });

  it('add string + Fraction rejects invalid string like mathjs', () => {
    expectSameThrow(compat.add, oracle.add, 'foo', compat.fraction(1));
  });

  it('subtract valueless unit matches mathjs', () => {
    const u = compat.unit('km');
    expectSameThrow(compat.subtract, oracle.subtract, u, compat.unit(5, 'km'));
  });
});

describe('#1773 unary matrix / map hint and special cases', () => {
  it('exp on array suggests map(M, exp)', () => {
    expectSameThrow(compat.exp, oracle.exp, [0, 1, 2]);
  });

  it('gamma on matrix suggests map(M, gamma)', () => {
    expectSameThrow(compat.gamma, oracle.gamma, compat.matrix([0, 1, 2]));
  });

  it('bitNot non-integer uses Integer expected wording', () => {
    expectSameThrow(compat.bitNot, oracle.bitNot, 1.1);
  });

  it('norm non-square matrix with p=2 throws RangeError', () => {
    expectSameThrow(
      compat.norm,
      oracle.norm,
      [
        [1, 2, 3],
        [2, 1, 3],
      ],
      2
    );
  });

  it('random rejects BigNumber bounds', () => {
    const math2 = compat.create({ randomSeed: 'test' });
    expectSameThrow(
      math2.random as Fn,
      oracle.create({ randomSeed: 'test' }).random as Fn,
      math2.bignumber(-10),
      10
    );
  });

  it('numeric invalid string for number output matches mathjs', () => {
    expectSameThrow(compat.numeric, oracle.numeric, 'foo', 'number');
  });

  it('boolean on complex and unit match mathjs', () => {
    expectSameThrow(compat.boolean, oracle.boolean, compat.complex(1, 2));
    expectSameThrow(compat.boolean, oracle.boolean, compat.unit('5cm'));
  });
});
