import { describe, it, expect } from 'vitest';
import {
  summation,
  symbolicProduct,
  laplace,
  inverseLaplace,
  symbolicPartialDerivative,
  casDerivative,
} from '../src/index.js';

describe('clone oracle — foldIntegerRange (summation / symbolicProduct)', () => {
  it('summation 1..100 = 5050', () => {
    expect(summation('k', 'k', 1, 100)).toBe(5050);
  });

  it('symbolicProduct 1..5 = 120', () => {
    expect(symbolicProduct('k', 'k', 1, 5)).toBe(120);
  });

  it('empty range returns sum identity 0 and product identity 1', () => {
    expect(summation('k', 'k', 5, 4)).toBe(0);
    expect(symbolicProduct('k', 'k', 5, 4)).toBe(1);
  });

  it('non-integer bounds step by 1 from a', () => {
    expect(summation('k', 'k', 1.5, 3.5)).toBe(1.5 + 2.5 + 3.5);
    expect(symbolicProduct('k', 'k', 1.5, 3.5)).toBe(1.5 * 2.5 * 3.5);
  });

  it('NaN bound throws with function name prefix', () => {
    expect(() => summation('k', 'k', NaN, 3)).toThrow(/^summation:/);
    expect(() => symbolicProduct('k', 'k', 1, NaN)).toThrow(/^symbolicProduct:/);
  });

  it('Infinity bound throws with function name prefix', () => {
    expect(() => summation('k', 'k', 1, Infinity)).toThrow(/^summation:/);
    expect(() => symbolicProduct('k', 'k', -Infinity, 2)).toThrow(/^symbolicProduct:/);
  });

  it('non-numeric bound throws', () => {
    expect(() => summation('k', 'k', 1, 'n' as unknown as number)).toThrow(/^summation:/);
    expect(() => symbolicProduct('k', 'k', 1, 'n' as unknown as number)).toThrow(
      /^symbolicProduct:/
    );
  });
});

describe('clone oracle — string derivative (symbolicPartialDerivative / casDerivative)', () => {
  it('power, trig, exp, log, linear, constant', () => {
    expect(symbolicPartialDerivative('x^2', 'x')).toBe('2*x^1');
    expect(symbolicPartialDerivative('sin(x)', 'x')).toBe('cos(x)');
    expect(symbolicPartialDerivative('cos(x)', 'x')).toBe('-sin(x)');
    expect(symbolicPartialDerivative('exp(x)', 'x')).toBe('exp(x)');
    expect(symbolicPartialDerivative('ln(x)', 'x')).toBe('1/x');
    expect(symbolicPartialDerivative('x', 'x')).toBe('1');
    expect(symbolicPartialDerivative('5', 'x')).toBe('0');
    expect(symbolicPartialDerivative('2*x + 3', 'x')).toBe('2 + 0');
    expect(symbolicPartialDerivative('x^2 + y', 'x')).toBe('2*x^1 + 0');
  });

  it('casDerivative matches _casDerivativeOne rules on the same inputs', () => {
    expect(casDerivative('x^2', 'x')).toBe('2*x^1');
    expect(casDerivative('sin(x)', 'x')).toBe('cos(x)');
    expect(casDerivative('cos(x)', 'x')).toBe('-sin(x)');
    expect(casDerivative('exp(x)', 'x')).toBe('exp(x)');
    expect(casDerivative('ln(x)', 'x')).toBe('1/x');
    expect(casDerivative('x', 'x')).toBe('1');
    expect(casDerivative('5', 'x')).toBe('0');
    expect(casDerivative('2*x + 3', 'x')).toBe('2 + 0');
    expect(casDerivative('x^2 + y', 'x')).toBe('2*x^1 + 0');
  });

  it('constants-only sum: partial gives per-term zeros, cas gives single zero', () => {
    expect(symbolicPartialDerivative('1 + 2', 'x')).toBe('0 + 0');
    expect(casDerivative('1 + 2', 'x')).toBe('0');
  });

  it('unrecognised term uses placeholder', () => {
    expect(symbolicPartialDerivative('foo(x)', 'x')).toBe('d/dx(foo(x))');
    expect(casDerivative('foo(x)', 'x')).toBe('d/dx(foo(x))');
  });

  it('empty expression', () => {
    expect(symbolicPartialDerivative('', 'x')).toBe('0');
    expect(casDerivative('', 'x')).toBe('0');
  });

  it('variable name that is a regex metacharacter (unchanged behavior)', () => {
    expect(symbolicPartialDerivative('a', 'a')).toBe('1');
    expect(casDerivative('a.b', 'a')).toBe('d/da(a.b)');
  });

  it('casDerivative array overload returns per-element derivatives', async () => {
    const results = await casDerivative(['x^2', '1 + 2'], 'x');
    expect(results).toEqual(['2*x^1', '0']);
  });
});

describe('clone oracle — Laplace table walk (laplace / inverseLaplace)', () => {
  it('documented laplace examples', () => {
    expect(laplace('1', 't', 's')).toBe('1/s');
    expect(laplace('t^2', 't', 's')).toBe('2/s^3');
    expect(laplace('sin(t)', 't', 's')).toBe('1/(s^2 + 1)');
    expect(laplace('exp(-t)', 't', 's')).toBe('1/(s + 1)');
  });

  it('documented inverseLaplace examples', () => {
    expect(inverseLaplace('1/s', 's', 't')).toBe('1');
    expect(inverseLaplace('1/(s + 1)', 's', 't')).toBe('exp(-1*t)');
  });

  it('unknown expression returns placeholder, not throw', () => {
    expect(laplace('t*sin(t)', 't', 's')).toBe('L{t*sin(t)}(s)');
    expect(inverseLaplace('1/(s^3+1)', 's', 't')).toBe('L^-1{1/(s^3+1)}(t)');
  });

  it('whitespace is trimmed', () => {
    expect(laplace('  1  ', 't', 's')).toBe('1/s');
    expect(inverseLaplace('  1/s  ', 's', 't')).toBe('1');
  });

  it('inverse Laplace of constant not in table stays placeholder (no c/s fallback)', () => {
    expect(inverseLaplace('5', 's', 't')).toBe('L^-1{5}(t)');
    expect(laplace('5', 't', 's')).toBe('5/s');
  });
});
