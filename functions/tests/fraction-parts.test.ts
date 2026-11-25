import { expect, it } from 'vitest';
import { compile, den, evaluate, fraction, num } from '../src/index.js';

it('returns reduced fraction parts from direct, evaluated and compiled calls', () => {
  expect(num(fraction(-6, 8))).toBe(-3n);
  expect(den([0.75, 0, -0.25])).toEqual([4n, 1n, 4n]);
  expect(evaluate('num(fraction(-6, 8))')).toBe(-3n);
  expect(compile('den(x)').evaluate({ x: 0.75 })).toBe(4n);
});
