/**
 * Sprint 2R clone-merge (and/or/bitAnd/bitOr transforms) — short-circuit oracles.
 */
import { describe, it, expect } from 'vitest';
import { evaluate } from '../../functions/src/factories/evaluate.js';
import { factoryScope } from '../../functions/src/factories/scope.js';

const and = factoryScope.and as (a: unknown, b: unknown) => unknown;
const or = factoryScope.or as (a: unknown, b: unknown) => unknown;

function makeScope(): Map<string, unknown> {
  let calls = 0;
  const side = (): number => {
    calls += 1;
    return 99;
  };
  const scope = new Map<string, unknown>([
    ['side', side],
    ['calls', () => calls],
  ]);
  return scope;
}

function sideCalls(scope: Map<string, unknown>): number {
  return (scope.get('calls') as () => number)();
}

const val = (r: unknown): unknown => {
  const m = r as { toArray?: () => unknown };
  if (m && typeof m.toArray === 'function') return m.toArray();
  return r;
};

describe('and / or transform short-circuit oracle', () => {
  it('false and side() does not call side and yields false', () => {
    const scope = makeScope();
    expect(evaluate('false and side()', scope)).toBe(false);
    expect(sideCalls(scope)).toBe(0);
  });

  it('0 and side() does not call side and yields false', () => {
    const scope = makeScope();
    expect(evaluate('0 and side()', scope)).toBe(false);
    expect(sideCalls(scope)).toBe(0);
  });

  it('true and 2 matches and(true, 2) and evaluates the right operand', () => {
    const scope = makeScope();
    expect(evaluate('true and 2', scope)).toBe(and(true, 2));
    expect(sideCalls(scope)).toBe(0);
  });

  it('true or side() does not call side and yields true', () => {
    const scope = makeScope();
    expect(evaluate('true or side()', scope)).toBe(true);
    expect(sideCalls(scope)).toBe(0);
  });

  it('false or 3 matches or(false, 3)', () => {
    const scope = makeScope();
    expect(evaluate('false or 3', scope)).toBe(or(false, 3));
  });

  it('element-wise collections evaluate both sides for and', () => {
    expect(val(evaluate('[0, 1] and [1, 0]'))).toEqual(val(and([0, 1], [1, 0])));
  });

  it('element-wise collections evaluate both sides for or', () => {
    expect(val(evaluate('[0, 1] or [1, 0]'))).toEqual(val(or([0, 1], [1, 0])));
  });
});

describe('bitAnd / bitOr transform short-circuit oracle', () => {
  it('0 & side() yields 0 without calling side', () => {
    const scope = makeScope();
    expect(evaluate('0 & side()', scope)).toBe(0);
    expect(sideCalls(scope)).toBe(0);
  });

  it('false & side() yields 0 without calling side', () => {
    const scope = makeScope();
    expect(evaluate('false & side()', scope)).toBe(0);
    expect(sideCalls(scope)).toBe(0);
  });

  it('NaN & side() yields NaN without calling side', () => {
    const scope = makeScope();
    expect(evaluate('NaN & side()', scope)).toBeNaN();
    expect(sideCalls(scope)).toBe(0);
  });

  it('1 & 2 evaluates both operands', () => {
    const scope = makeScope();
    expect(evaluate('1 & 2', scope)).toBe(0);
    expect(sideCalls(scope)).toBe(0);
  });

  it('-1 | side() yields -1 without calling side', () => {
    const scope = makeScope();
    expect(evaluate('-1 | side()', scope)).toBe(-1);
    expect(sideCalls(scope)).toBe(0);
  });

  it('true | side() yields 1 without calling side', () => {
    const scope = makeScope();
    expect(evaluate('true | side()', scope)).toBe(1);
    expect(sideCalls(scope)).toBe(0);
  });

  it('NaN | side() yields NaN without calling side', () => {
    const scope = makeScope();
    expect(evaluate('NaN | side()', scope)).toBeNaN();
    expect(sideCalls(scope)).toBe(0);
  });

  it('0 | 2 yields 2', () => {
    expect(evaluate('0 | 2')).toBe(2);
  });

  it('bitAnd with plain object on the left returns NaN without evaluating the right', () => {
    const scope = makeScope();
    expect(evaluate('{} & side()', scope)).toBeNaN();
    expect(sideCalls(scope)).toBe(0);
  });

  it('element-wise collections evaluate both sides for bitAnd and bitOr', () => {
    expect(val(evaluate('[0, 3] & [1, 1]'))).toEqual(val([0, 1]));
    expect(val(evaluate('[0, 3] | [1, 1]'))).toEqual(val([1, 3]));
  });

  it('right operand that throws is reached only when absorb does not take', () => {
    const scope = new Map<string, unknown>([
      [
        'boom',
        () => {
          throw new Error('boom');
        },
      ],
    ]);
    expect(() => evaluate('true and boom()', scope)).toThrow('boom');
    expect(evaluate('false and boom()', scope)).toBe(false);
  });
});
