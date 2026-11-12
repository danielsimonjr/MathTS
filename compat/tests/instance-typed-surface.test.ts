import { describe, it, expect } from 'vitest';
import { mathTyped } from '@danielsimonjr/mathts-core';
import { create, all } from '../src/index.js';

/**
 * `create(all).typed` is declared as `typeof mathTyped`. Every function member
 * of that type must exist on the instance, not only the call signature.
 */
describe('create(all).typed has the mathTyped surface', () => {
  const members = Object.getOwnPropertyNames(mathTyped).filter(
    (key) => typeof (mathTyped as unknown as Record<string, unknown>)[key] === 'function'
  );

  it('the declared type has registry members', () => {
    expect(members).toContain('addConversion');
  });

  it.each(members)('typed.%s is a function', (key) => {
    const typed = create(all).typed as unknown as Record<string, unknown>;
    expect(typeof typed[key]).toBe('function');
  });

  it('typed still builds a typed function', () => {
    const typed = create(all).typed;
    const double = typed('double', { number: (x: number) => 2 * x }) as (x: number) => number;
    expect(double(3)).toBe(6);
    expect(typed.isTypedFunction(double)).toBe(true);
  });
});
