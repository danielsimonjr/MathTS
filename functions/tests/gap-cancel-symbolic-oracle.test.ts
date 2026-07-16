import { describe, it, expect } from 'vitest';
import { cancel } from '../src/index.js';
import { evaluate } from '../src/factories/evaluate.js';

/**
 * Oracle: sympy.cancel(...) for each input (ground truth, computed
 * out-of-band — see the task spec). The primary check is implementation
 * -independent: cancellation must preserve the function's VALUE away from
 * poles, not match a particular string layout. A secondary structural check
 * (whether the result still contains a `/`) distinguishes "fully reduced to
 * a polynomial" from "reduced but still a proper fraction" per the oracle.
 */
describe('cancel — univariate symbolic rational cancellation (oracle: sympy.cancel)', () => {
  const samplePoints = [2, 3, 5, 0.5];

  function expectValuePreserving(input: string, out: string): void {
    for (const x0 of samplePoints) {
      const expected = evaluate(input, { x: x0 });
      const actual = evaluate(out, { x: x0 });
      expect(actual).toBeCloseTo(expected as number, 9);
    }
  }

  it('(x^2-1)/(x-1) -> x + 1 (fully reduces to a polynomial)', () => {
    const input = '(x^2-1)/(x-1)';
    const out = cancel(input);
    expect(out).not.toContain('/');
    expectValuePreserving(input, out);
    expect(evaluate(out, { x: 0 })).toBeCloseTo(1, 9);
  });

  it('(x^2+2*x+1)/(x+1) -> x + 1 (fully reduces to a polynomial)', () => {
    const input = '(x^2+2*x+1)/(x+1)';
    const out = cancel(input);
    expect(out).not.toContain('/');
    expectValuePreserving(input, out);
    expect(evaluate(out, { x: 0 })).toBeCloseTo(1, 9);
  });

  it('(2*x^2-2)/(2*x-2) -> x + 1 (numeric content also cancels)', () => {
    const input = '(2*x^2-2)/(2*x-2)';
    const out = cancel(input);
    expect(out).not.toContain('/');
    expectValuePreserving(input, out);
    expect(evaluate(out, { x: 0 })).toBeCloseTo(1, 9);
  });

  it('(x^3-1)/(x^2-1) -> (x^2+x+1)/(x+1) (degree reduces, stays a fraction)', () => {
    const input = '(x^3-1)/(x^2-1)';
    const out = cancel(input);
    expect(out).toContain('/');
    expectValuePreserving(input, out);
  });

  it('regression: plain numeric fraction 6/4 -> 3/2', () => {
    expect(cancel('6/4')).toBe('3/2');
  });

  it('regression: compound numeric fraction (2/3)/(4/9) -> 3/2', () => {
    expect(cancel('(2/3)/(4/9)')).toBe('3/2');
  });

  it('regression: identical-string short-circuit (x+1)/(x+1) -> 1', () => {
    expect(cancel('(x+1)/(x+1)')).toBe('1');
  });

  it('regression: existing numeric tests still pass', () => {
    expect(cancel('10/5')).toBe('2');
  });
});
