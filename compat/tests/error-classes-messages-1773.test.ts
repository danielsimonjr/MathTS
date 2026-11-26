/**
 * #1773: compat error classes and message text match mathjs 15.3.0 for the
 * redirected unit-test scenarios (add/null, arity, matrix map hints, …).
 */
import { describe, expect, it } from 'vitest';
import { create as createOracle, all as oracleAll } from 'mathjs';
import { create, all, ArgumentsError, DimensionError, IndexError } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const compat = create(all) as unknown as Record<string, Fn>;
const oracle = createOracle(oracleAll) as unknown as Record<string, Fn>;

const cfn = (name: string): Fn => compat[name] as Fn;
const ofn = (name: string): Fn => oracle[name] as Fn;

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
    expect(ArgumentsError).toBeTypeOf('function');
  });
});

describe('#1773 scalar and arity messages', () => {
  it('add(null, 1) throws typed-function style error', () => {
    expect(() => cfn('add')(null, 1)).toThrow(TypeError);
    expect(() => cfn('add')(null, 1)).toThrow(/Unexpected type of argument in function add/);
  });

  it('bitAnd arity rejects with Too many arguments', () => {
    expectSameThrow(cfn('bitAnd'), ofn('bitAnd'), 1, 2, 3);
  });

  it('dotMultiply arity rejects with Too few arguments', () => {
    expect(() => cfn('dotMultiply')(1)).toThrow(TypeError);
    expect(() => cfn('dotMultiply')(1)).toThrow(/Too few arguments in function dotMultiply/);
  });

  it('typeOf arity rejects with Too many arguments', () => {
    expectSameThrow(cfn('typeOf'), ofn('typeOf'), 1, 2);
  });
});

describe('#1773 conversion and unit errors', () => {
  it('add string + BigNumber rejects invalid string like mathjs', () => {
    const bn = cfn('bignumber')('1');
    expect(() => cfn('add')('foo', bn)).toThrow(Error);
    expect(() => cfn('add')('foo', bn)).toThrow(/Cannot convert "foo" to BigNumber/);
    expect(() => ofn('add')('foo', ofn('bignumber')('1'))).toThrow(
      /Cannot convert "foo" to BigNumber/
    );
    expectSameThrow(cfn('add'), ofn('add'), 'foo', bn);
  });

  it('add string + Fraction rejects invalid string like mathjs', () => {
    expectSameThrow(cfn('add'), ofn('add'), 'foo', cfn('fraction')(1, 1));
  });

  it('subtract valueless unit matches mathjs', () => {
    const u = cfn('unit')('km');
    expectSameThrow(cfn('subtract'), ofn('subtract'), u, cfn('unit')(5, 'km'));
  });
});

describe('#1773 unary matrix / map hint and special cases', () => {
  it('exp on array suggests map(M, exp)', () => {
    expectSameThrow(cfn('exp'), ofn('exp'), [0, 1, 2]);
  });

  it('gamma on matrix suggests map(M, gamma)', () => {
    expectSameThrow(cfn('gamma'), ofn('gamma'), cfn('matrix')([0, 1, 2]));
  });

  it('bitNot non-integer uses Integer expected wording', () => {
    expectSameThrow(cfn('bitNot'), ofn('bitNot'), 1.1);
  });

  it('norm non-square matrix with p=2 throws RangeError', () => {
    expectSameThrow(
      cfn('norm'),
      ofn('norm'),
      [
        [1, 2, 3],
        [2, 1, 3],
      ],
      2
    );
  });

  it('random rejects BigNumber bounds', () => {
    const math2 = create(all, { randomSeed: 'test' }) as unknown as Record<string, Fn>;
    const oracle2 = createOracle(oracleAll, { randomSeed: 'test' }) as unknown as Record<
      string,
      Fn
    >;
    expectSameThrow(math2.random as Fn, oracle2.random as Fn, math2.bignumber(-10), 10);
  });

  it('numeric invalid string for number output matches mathjs', () => {
    expectSameThrow(cfn('numeric'), ofn('numeric'), 'foo', 'number');
  });

  it('boolean on complex and unit match mathjs', () => {
    expectSameThrow(cfn('boolean'), ofn('boolean'), cfn('complex')(1, 2));
    expectSameThrow(cfn('boolean'), ofn('boolean'), cfn('unit')('5cm'));
  });
});

describe('#1773 PR review regressions', () => {
  it('bigint(), number(), boolean() accept 0 args and reject excess args', () => {
    expect(cfn('bigint')()).toBe(0n);
    expectSameThrow(cfn('bigint'), ofn('bigint'), 1, 2);

    expect(cfn('number')()).toBe(0);
    expect(cfn('number')(cfn('unit')('52cm'), 'm')).toBe(0.52);
    expect(cfn('number')(cfn('unit')('52cm'), cfn('unit')('m'))).toBe(0.52);
    expectSameThrow(cfn('number'), ofn('number'), 1, 2);
    expectSameThrow(cfn('number'), ofn('number'), cfn('unit')('52cm'), 'm', 3);

    expect(cfn('boolean')()).toBe(false);
    expectSameThrow(cfn('boolean'), ofn('boolean'), 1, 2);
  });

  it('IndexError without new throws SyntaxError and preserves instanceof', () => {
    const bare = IndexError as unknown as (index: number) => unknown;
    expect(() => bare(5)).toThrow(SyntaxError);
    expect(() => bare(5)).toThrow('Constructor must be called with the new operator');
    const err = new IndexError(5);
    expect(err).toBeInstanceOf(IndexError);
    expect(err).toBeInstanceOf(RangeError);
  });

  it('named and instance error constructors are identical', () => {
    const inst = create(all);
    expect(inst.ArgumentsError).toBe(ArgumentsError);
    expect(inst.DimensionError).toBe(DimensionError);
    expect(inst.IndexError).toBe(IndexError);
  });

  it('tooFewArgumentsError uses index 0 for 0-arg calls and index 1 for 1-arg binary calls', () => {
    expectSameThrow(cfn('typeOf'), ofn('typeOf'));
    expect(() => cfn('bitNot')()).toThrow(TypeError);
    expect(() => cfn('bitNot')()).toThrow(/Too few arguments in function bitNot.*index: 0/);
    expect(() => cfn('dotMultiply')(1)).toThrow(TypeError);
    expect(() => cfn('dotMultiply')(1)).toThrow(
      /Too few arguments in function dotMultiply.*index: 1/
    );
  });

  it('random(1, 2, 3, 4) matches mathjs expected count of 2', () => {
    expectSameThrow(cfn('random'), ofn('random'), 1, 2, 3, 4);
    expectSameThrow(cfn('random'), ofn('random'), 1, 2, 3);
  });

  it('add(null, 1), add(null, 0), and add(unit, 2) match mathjs wording', () => {
    expect(() => cfn('add')(null, 1)).toThrow(TypeError);
    expect(() => cfn('add')(null, 1)).toThrow(
      /Unexpected type of argument in function add.*actual: identifier \| null, index: 0/
    );
    expect(() => cfn('add')(null, 0)).toThrow(TypeError);
    expect(() => cfn('add')(null, 0)).toThrow(
      /Unexpected type of argument in function add.*actual: identifier \| null, index: 0/
    );
    expect(() => cfn('add')(cfn('unit')('5cm'), 2)).toThrow(TypeError);
    expect(() => cfn('add')(cfn('unit')('5cm'), 2)).toThrow(
      /Unexpected type of argument in function add.*\(expected: Unit, actual: number, index: 1\)/
    );
  });
});
