/**
 * #1024: `symbolicIntegral`, `laplace` and `inverseLaplace` returned a marker
 * (`integral(...)`, `L{...}(s)`, `L^-1{...}(t)`) for common inputs.
 *
 * Each reported input now has a closed form. An input outside the supported forms keeps the
 * `integral(...)` marker in `symbolicIntegral` (it parses as a call), and `laplace` and
 * `inverseLaplace` throw a `NoClosedFormError`.
 */

import { describe, it, expect } from 'vitest';
import {
  symbolicIntegral,
  laplace,
  inverseLaplace,
  evaluate,
  NoClosedFormError,
} from '../src/index.js';

const MARKER = /^(integral\(|L\{|L\^-1\{)/;

/** The real value of `text` at the scope. */
function value(text: string, scope: Record<string, number>): number {
  const v = evaluate(text, scope) as unknown;
  if (typeof v !== 'number')
    throw new Error(`"${text}" is not a real number at ${JSON.stringify(scope)}`);
  return v;
}

/** `text` is the same function as `reference` at every point (relative error 1e-12). */
function expectSameFunction(
  text: string,
  name: string,
  reference: (x: number) => number,
  points: number[]
): void {
  expect(text).not.toMatch(MARKER);
  for (const p of points) {
    const want = reference(p);
    const got = value(text, { [name]: p });
    expect(Math.abs(got - want)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(want)));
  }
}

/** `text` is an antiderivative of `integrand`: a central difference (h = 1e-5, error about 1e-10) matches it. */
function expectAntiderivative(
  text: string,
  integrand: (x: number) => number,
  points: number[] = [0.3, 0.7, 1.3, 2.1]
): void {
  expect(text).not.toMatch(MARKER);
  const h = 1e-5;
  for (const x of points) {
    const slope = (value(text, { x: x + h }) - value(text, { x: x - h })) / (2 * h);
    expect(Math.abs(slope - integrand(x))).toBeLessThanOrEqual(1e-7);
  }
}

describe('#1024 symbolicIntegral: powers of sin and cos, polynomial times log', () => {
  it('cos(x)^2', () => {
    expectAntiderivative(symbolicIntegral('cos(x)^2', 'x'), (x) => Math.cos(x) ** 2);
  });

  it('x^3*log(x)', () => {
    expectAntiderivative(symbolicIntegral('x^3*log(x)', 'x'), (x) => x ** 3 * Math.log(x));
  });

  it.each([
    ['sin(x)^2', (x: number) => Math.sin(x) ** 2],
    ['sin(2*x+1)^3', (x: number) => Math.sin(2 * x + 1) ** 3],
    ['cos(x)^4', (x: number) => Math.cos(x) ** 4],
    ['cos(3*x)^2', (x: number) => Math.cos(3 * x) ** 2],
    ['log(x)', (x: number) => Math.log(x)],
    ['x*log(2*x+1)', (x: number) => x * Math.log(2 * x + 1)],
    ['x^2*log(x)', (x: number) => x ** 2 * Math.log(x)],
  ])('%s', (src, f) => {
    expectAntiderivative(symbolicIntegral(src, 'x'), f);
  });

  it('keeps the exact text of a power of x and of sin(x)', () => {
    expect(symbolicIntegral('x^3', 'x')).toBe('(x)^4 / 4');
    expect(symbolicIntegral('sin(x)', 'x')).toBe('-cos(x)');
  });

  it('keeps the marker for a form outside the supported subset', () => {
    expect(symbolicIntegral('sin(x^2)', 'x')).toBe('integral(sin(x^2), x)');
    expect(symbolicIntegral('log(x)^2', 'x')).toMatch(MARKER);
  });
});

describe('#1024 laplace: linearity, shift theorem, t^n*exp', () => {
  it('t*exp(-t) is 1/(s+1)^2', () => {
    const text = laplace('t*exp(-t)', 't', 's');
    expectSameFunction(text, 's', (s) => 1 / (s + 1) ** 2, [2, 3, 5]);
  });

  it.each([
    ['t^2*exp(3*t)', (s: number) => 2 / (s - 3) ** 3, [4, 5, 7]],
    ['exp(-2*t)*sin(3*t)', (s: number) => 3 / ((s + 2) ** 2 + 9), [1, 2, 5]],
    ['exp(-2*t)*cos(3*t)', (s: number) => (s + 2) / ((s + 2) ** 2 + 9), [1, 2, 5]],
    ['3*t + 2', (s: number) => 3 / s ** 2 + 2 / s, [1, 2, 5]],
    ['t^3*exp(-t) - 2*exp(2*t)', (s: number) => 6 / (s + 1) ** 4 - 2 / (s - 2), [3, 4, 6]],
    ['5*exp(-t)*cos(2*t)', (s: number) => (5 * (s + 1)) / ((s + 1) ** 2 + 4), [1, 2, 5]],
  ])('%s', (src, ref, points) => {
    expectSameFunction(laplace(src, 't', 's'), 's', ref, points);
  });

  it('keeps the exact text of the four documented examples', () => {
    expect(laplace('1', 't', 's')).toBe('1/s');
    expect(laplace('t^2', 't', 's')).toBe('2/s^3');
    expect(laplace('sin(t)', 't', 's')).toBe('1/(s^2 + 1)');
    expect(laplace('exp(-t)', 't', 's')).toBe('1/(s + 1)');
  });

  it('throws NoClosedFormError for t*sin(t) (outside the supported forms)', () => {
    expect(() => laplace('t*sin(t)', 't', 's')).toThrow(NoClosedFormError);
  });
});

describe('#1024 inverseLaplace: rational functions', () => {
  it('1/(s^2+1) is sin(t)', () => {
    expectSameFunction(inverseLaplace('1/(s^2+1)', 's', 't'), 't', Math.sin, [0.3, 1, 2]);
  });

  it('1/(s-2) is exp(2t)', () => {
    expectSameFunction(
      inverseLaplace('1/(s-2)', 's', 't'),
      't',
      (t) => Math.exp(2 * t),
      [0.3, 1, 2]
    );
  });

  it.each([
    ['1/(s+1)^2', (t: number) => t * Math.exp(-t)],
    ['(s+3)/(s^2+3*s+2)', (t: number) => 2 * Math.exp(-t) - Math.exp(-2 * t)],
    ['1/(s^2+2*s+5)', (t: number) => (Math.exp(-t) * Math.sin(2 * t)) / 2],
    ['1/((s+1)^2*(s+2))', (t: number) => -Math.exp(-t) + t * Math.exp(-t) + Math.exp(-2 * t)],
    ['1/(s^2*(s+1))', (t: number) => t - 1 + Math.exp(-t)],
    ['1/(s+1)^3', (t: number) => (t * t * Math.exp(-t)) / 2],
    ['1/((s+1)*(s^2+1))', (t: number) => (Math.exp(-t) - Math.cos(t) + Math.sin(t)) / 2],
    ['(2*s+1)/(s^2+4)', (t: number) => 2 * Math.cos(2 * t) + Math.sin(2 * t) / 2],
    ['1/(s^2-1)', (t: number) => Math.sinh(t)],
    [
      '1/(s*(s+1)*(s+2)*(s+3))',
      (t: number) => 1 / 6 - Math.exp(-t) / 2 + Math.exp(-2 * t) / 2 - Math.exp(-3 * t) / 6,
    ],
  ])('%s', (src, ref) => {
    expectSameFunction(inverseLaplace(src, 's', 't'), 't', ref, [0.3, 1, 2]);
  });

  it('1/(s^3+1): one real pole and one complex pair', () => {
    const ref = (t: number) =>
      Math.exp(-t) / 3 +
      Math.exp(t / 2) *
        (-Math.cos((Math.sqrt(3) * t) / 2) / 3 + Math.sin((Math.sqrt(3) * t) / 2) / Math.sqrt(3));
    expectSameFunction(inverseLaplace('1/(s^3+1)', 's', 't'), 't', ref, [0.3, 1, 2]);
  });

  it('a sum of two fractions', () => {
    expectSameFunction(
      inverseLaplace('1/(s+1) + 2/(s+2)', 's', 't'),
      't',
      (t) => Math.exp(-t) + 2 * Math.exp(-2 * t),
      [0.3, 1, 2]
    );
  });

  it('round trip: inverseLaplace(laplace(t*exp(-t))) is t*exp(-t)', () => {
    const back = inverseLaplace(laplace('t*exp(-t)', 't', 's'), 's', 't');
    expectSameFunction(back, 't', (t) => t * Math.exp(-t), [0.3, 1, 2]);
  });

  it('keeps the exact text of the table examples', () => {
    expect(inverseLaplace('1/s', 's', 't')).toBe('1');
    expect(inverseLaplace('1/(s + 1)', 's', 't')).toBe('exp(-1*t)');
  });

  it('throws NoClosedFormError when the degree of the numerator is not below the denominator', () => {
    expect(() => inverseLaplace('5', 's', 't')).toThrow(NoClosedFormError);
    expect(() => inverseLaplace('s^2/(s+1)', 's', 't')).toThrow(NoClosedFormError);
  });
});

describe('#1024 log with a base is not the natural log', () => {
  // SymPy: integrate(x*log(x, 2), x) = x^2*log(x)/(2*log(2)) - x^2/(4*log(2)). No rule here
  // carries the factor 1/log(base), so each form keeps the marker.
  it('x*log(x, 2) keeps the marker (it gave the natural-log antiderivative)', () => {
    expect(symbolicIntegral('x*log(x, 2)', 'x')).toBe('integral(x*log(x, 2), x)');
  });

  it('x^2*log(2*x + 1, 10) keeps the marker', () => {
    expect(symbolicIntegral('x^2*log(2*x + 1, 10)', 'x')).toMatch(MARKER);
  });

  it('log(x, 10) keeps the marker (it gave x*log(x) - x)', () => {
    expect(symbolicIntegral('log(x, 10)', 'x')).toMatch(MARKER);
  });

  it('the one-argument forms still integrate', () => {
    expect(symbolicIntegral('log(x)', 'x')).toBe('x * log(x) - x');
    expect(symbolicIntegral('x*log(x)', 'x')).toBe('(0.5*x^2) * log(x) - (0.25*x^2)');
  });
});
