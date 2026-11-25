import { describe, expect, it } from 'vitest';
import * as reference from 'mathjs';
import * as compat from '../src/index.js';

describe('mathjs scalar functions', () => {
  const math = compat.create(compat.all);
  const names = [
    'acos',
    'acosh',
    'acot',
    'acsc',
    'asec',
    'asin',
    'asinh',
    'atan',
    'atanh',
    'cbrt',
    'cos',
    'cosh',
    'cot',
    'csc',
    'cube',
    'exp',
    'expm1',
    'lgamma',
    'log',
    'permutations',
    'sec',
    'sin',
    'sinh',
    'sqrt',
    'square',
    'tan',
    'tanh',
  ] as const;

  it('matches both signs of imaginary zero on the complex square-root branch cut', () => {
    const subset = compat.create({ sqrtDependencies: compat.sqrtDependencies });
    for (const real of [-Infinity, -7, 0, 7]) {
      for (const imaginary of [-0, 0]) {
        const z = math.complex(real, imaginary);
        const expected = reference.sqrt(reference.complex(real, imaginary)) as reference.Complex;
        for (const result of [
          compat.sqrt(z),
          math.sqrt(z),
          subset.sqrt(z),
          math.evaluate('sqrt(z)', { z }),
        ]) {
          const { re, im } = result as { re: number; im: number };
          expect(re).toBe(expected.re);
          expect(im).toBe(expected.im);
        }
      }
    }
  });

  it.each(names)('%s rejects arrays and matrices at each entry point', (name) => {
    const scalar = (fn: unknown) => fn as (value: unknown) => unknown;
    expect(() => scalar(reference[name])([1, 2])).toThrow(TypeError);
    for (const value of [[1, 2], math.matrix([1, 2])]) {
      expect(() => scalar(compat[name])(value)).toThrow(TypeError);
      expect(() => scalar(math[name])(value)).toThrow(TypeError);
    }
    expect(() => math.evaluate(name + '([1, 2])')).toThrow(TypeError);
    expect(() => math.parse(name + '([1, 2])').evaluate()).toThrow(TypeError);
    expect(() => math.compile(name + '([1, 2])').evaluate()).toThrow(TypeError);
  });
});
