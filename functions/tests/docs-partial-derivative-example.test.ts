/**
 * The `partialDerivative` example of docs/advanced.md: the function is numeric and needs a scope.
 */
import { describe, it, expect } from 'vitest';
import { partialDerivative } from '../src/typed/cas.js';

describe('partialDerivative: the docs example and a missing scope', () => {
  it("partialDerivative('x^2*y + y^3', 'y', { x: 2, y: 3 }) is x^2 + 3*y^2 = 31", () => {
    expect(partialDerivative('x^2*y + y^3', 'y', { x: 2, y: 3 })).toBeCloseTo(31, 6);
  });

  it('a missing scope throws a TypeError that names the function and the parameter', () => {
    const call = () => (partialDerivative as (e: string, v: string) => number)('x^2*y + y^3', 'y');
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/partialDerivative.*scope/);
  });
});
