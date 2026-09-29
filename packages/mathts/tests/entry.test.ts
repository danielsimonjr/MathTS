import { describe, expect, it } from 'vitest';
import { derivative, forwardGrad, reverseGrad, TapedTensor } from '../src/autograd.js';
import { evaluate, parse, simplify } from '../src/index.js';
import * as functions from '../src/functions.js';
import { Tensor } from '../src/tensor.js';

/**
 * The calls Universal-Physics-Tensor makes, through this package instead of the
 * scoped peers. Behaviour of each kernel lives in the package that implements it.
 */
describe('@danielsimonjr/mathts', () => {
  it('evaluates arithmetic and parses a call', () => {
    expect(evaluate('1+2*3')).toBe(7);
    expect(evaluate('(1+2)*3')).toBe(9);
    expect(evaluate('2^3')).toBe(8);
    expect(parse('sqrt(4)').evaluate({})).toBe(2);
    expect(evaluate('sin(0)')).toBe(0);
    expect(evaluate('a*b^2+1', { a: 3, b: 4 })).toBe(49);
  });

  it('keeps the mathjs language UPT pins as MathTS-only', () => {
    expect(parse('e').evaluate({})).toBeCloseTo(Math.E, 12);
    expect(parse('5!').evaluate({})).toBe(120);
    expect(parse('erf(0)').evaluate({})).toBeCloseTo(0, 12);
    expect(parse('gamma(5)').evaluate({})).toBeCloseTo(24, 10);
    expect(parse('2pi').evaluate({})).toBeCloseTo(2 * Math.PI, 12);
  });

  it('re-exports the same parse and simplify the functions package ships', () => {
    expect(functions.parse).toBe(parse);
    expect(functions.simplify).toBe(simplify);
    const cancelled = simplify(parse('(g0)*((g1)/(g0))'));
    expect(String(cancelled)).toBe('g1');
  });

  it('exposes Tensor.fromNested on the tensor subpath', () => {
    const t = Tensor.fromNested([1, 2, 3], [3]);
    expect(t.sum().toNested()).toBe(6);
  });

  it('exposes derivative, forwardGrad, reverseGrad, and TapedTensor', () => {
    expect(derivative((x) => x.mul(x), 3)).toBe(6);
    expect(typeof forwardGrad).toBe('function');
    expect(typeof reverseGrad).toBe('function');
    expect(typeof TapedTensor).toBe('function');
  });
});
