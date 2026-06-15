import { describe, it, expect } from 'vitest';
import { add, subtract, multiply, divide, sqrt, pow, abs, mod } from '../src/index.js';

/**
 * Re-export of the arithmetic typed-function domain from
 * `@danielsimonjr/mathts-functions`. These functions are callable, so the tests
 * compute real results. Full behaviour is covered by the functions package.
 */
describe('@danielsimonjr/mathts-arithmetic', () => {
  it('computes basic arithmetic', () => {
    expect(add(2, 3)).toBe(5);
    expect(subtract(5, 2)).toBe(3);
    expect(multiply(2, 3)).toBe(6);
    expect(divide(6, 2)).toBe(3);
    expect(sqrt(16)).toBe(4);
    expect(pow(2, 3)).toBe(8);
    expect(abs(-4)).toBe(4);
    expect(mod(7, 3)).toBe(1);
  });
});
