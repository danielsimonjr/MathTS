import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import {
  asMathjsExpressionScopeValue,
  unwrapMathjsExpressionScopeValue,
  wrapCompatSandboxIndex,
} from '../src/mathjs-factory-expression.js';
import {
  guardMathjsForbiddenArrayMemberAssignment,
  guardMathjsObjectLiteralKeys,
} from '../src/mathjs-parse-sandbox.js';
import { remapMathjsSandboxEvaluateError } from '../src/mathjs-sandbox-errors.js';

const math = create(all);

describe('#1777 compat sandbox error messages (mathjs 15.3.0 oracle)', () => {
  it('bare constructor/toString use property-access errors, not undefined symbol', () => {
    expect(() => math.evaluate('constructor', {})).toThrow(/No access to property "constructor"/);
    expect(() => math.evaluate('toString', {})).toThrow(
      /Cannot access method "toString" as a property/
    );
  });

  it('member constructor access matches mathjs', () => {
    expect(() => math.evaluate('sin.constructor')).toThrow(/No access to property "constructor"/);
    expect(() => math.evaluate('({a:1})["constructor"]')).toThrow(
      /No access to property "constructor"/
    );
    expect(() => math.evaluate('obj.constructor', { obj: { a: 42 } })).toThrow(
      /No access to property "constructor"/
    );
  });

  it('rejects object literals with forbidden keys that parse would strip', () => {
    expect(() => math.evaluate('{constructor: 2}')).toThrow(/No access to property "constructor"/);
    expect(() => math.evaluate('{hasOwnProperty: 2}')).toThrow(
      /No access to property "hasOwnProperty"/
    );
  });

  it('valueless unit symbol chain resolves like mathjs', () => {
    expect(math.evaluate('chain')).toEqual(math.unit('chain'));
  });

  it('mathWithTransform functions are plain for the security namespace scan', () => {
    function isPlainFunction(fn: unknown): boolean {
      return (
        typeof fn === 'function' &&
        (fn as { prototype?: { constructor?: unknown } }).prototype?.constructor === fn
      );
    }
    for (const [name, value] of Object.entries(math.expression.mathWithTransform)) {
      if (typeof value === 'function') {
        expect(isPlainFunction(value), `plain function expected for ${name}`).toBe(true);
      }
    }
  });

  it('asMathjsExpressionScopeValue wraps arrow functions without mutating them', () => {
    const arrow = (x: number) => x + 1;
    expect((arrow as { prototype?: unknown }).prototype).toBeUndefined();
    const wrapped = asMathjsExpressionScopeValue(arrow) as ((x: number) => number) & {
      prototype?: { constructor?: unknown };
    };
    expect(wrapped).not.toBe(arrow);
    expect(wrapped.prototype?.constructor).toBe(wrapped);
    expect(wrapped(41)).toBe(42);
    expect((arrow as { prototype?: unknown }).prototype).toBeUndefined();
    expect(asMathjsExpressionScopeValue(arrow)).toBe(wrapped);
    expect(unwrapMathjsExpressionScopeValue(wrapped)).toBe(arrow);
    expect(unwrapMathjsExpressionScopeValue(123)).toBe(123);
  });

  it('wrapCompatSandboxIndex passes primitives through and keeps constructor unbound', () => {
    const prim = wrapCompatSandboxIndex(() => null);
    expect(prim()).toBeNull();
    const wrapped = wrapCompatSandboxIndex(() => math.index(0, 1));
    const idx = wrapped() as { isTensor?: boolean; dimension: (n: number) => unknown };
    expect(idx.isTensor).toBe(true);
    expect(typeof idx.dimension).toBe('function');
  });

  it('guardMathjsObjectLiteralKeys and guardMathjsForbiddenArrayMemberAssignment cover unicode and array assignments', () => {
    expect(() => guardMathjsForbiddenArrayMemberAssignment('a.map = 1')).toThrow(
      /No access to property "map"/
    );
    expect(() => guardMathjsObjectLiteralKeys('{"\\u0063onstructor": 1}')).toThrow(
      /No access to property "constructor"/
    );
    expect(() => guardMathjsObjectLiteralKeys('x = { toString: 1 }')).toThrow(
      /No access to property "toString"/
    );
  });

  it('remapMathjsSandboxEvaluateError maps index and subset errors and rethrows others', () => {
    expect(() =>
      remapMathjsSandboxEvaluateError(
        new Error('Index must be an integer (value: [object Object])')
      )
    ).toThrow('Array expected for index');
    expect(() =>
      remapMathjsSandboxEvaluateError(
        new TypeError(
          'Unexpected type of argument in function subset (expected: Index, actual: any)'
        )
      )
    ).toThrow(/actual: Object/);
    expect(() => remapMathjsSandboxEvaluateError(new Error('other'))).toThrow('other');
    expect(() => remapMathjsSandboxEvaluateError('non-error')).toThrow('non-error');
  });

  it('compile supports both mathjs policy and safe policy', () => {
    expect(math.compile('2 + 3').evaluate()).toBe(5);
    const compileWithOpts = math.compile as (
      expr: string,
      opts?: { safe?: boolean }
    ) => { evaluate: () => unknown };
    const evalWithOpts = math.evaluate as (
      expr: string,
      scope?: Record<string, unknown>,
      opts?: { safe?: boolean }
    ) => unknown;
    expect(compileWithOpts('2 + 3', { safe: true }).evaluate()).toBe(5);
    expect(evalWithOpts('2 + 3', undefined, { safe: true })).toBe(5);
  });
});
