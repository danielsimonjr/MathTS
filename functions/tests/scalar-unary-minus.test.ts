import { describe, it, expect } from 'vitest';
import { compileScalar, compileScalarGradient, evaluateScalar, scalar } from '../src/index.js';

const negX = scalar.op('-', [scalar.symbol('x')]);
const plusX = scalar.op('+', [scalar.symbol('x')]);
// -(x^2): value -9 and gradient -6 at x = 3.
const negXSquared = scalar.op('-', [scalar.op('^', [scalar.symbol('x'), scalar.number(2)])]);

describe('one-argument - negates (issue #624)', () => {
  it('evaluateScalar negates', () => {
    expect(evaluateScalar(negX, { x: 3 })).toBe(-3);
    expect(evaluateScalar(scalar.op('-', [scalar.number(4)]))).toBe(-4);
    expect(evaluateScalar(negXSquared, { x: 3 })).toBe(-9);
  });

  it('compileScalar negates every row', () => {
    const out = compileScalar(negX, { variables: ['x'] }).evaluate([Float64Array.of(3, -2, 0)]);
    expect([...out.values]).toEqual([-3, 2, -0]);
  });

  it('compileScalarGradient negates the value and the partial', () => {
    const g = compileScalarGradient(negXSquared, { variables: [], parameters: ['x'] });
    const { values, grad } = g.evaluate([], [3]);
    expect(values[0]).toBe(-9);
    expect(grad[0]).toBe(-6);
  });

  it('control: one-argument + is the identity', () => {
    expect(evaluateScalar(plusX, { x: 3 })).toBe(3);
    const g = compileScalarGradient(
      scalar.op('+', [scalar.op('^', [scalar.symbol('x'), scalar.number(2)])]),
      { variables: [], parameters: ['x'] }
    );
    const { values, grad } = g.evaluate([], [3]);
    expect(values[0]).toBe(9);
    expect(grad[0]).toBe(6);
  });
});
