import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

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
});
