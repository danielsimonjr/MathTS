import { describe, it, expect } from 'vitest';
import { rationalize, simplify } from '../src/index.js';

// #1177: rationalize of a product of sums threw "Invalid + placing" (or "- placing", "* placing").
// Cause: simplify applied its factored canonical form to the custom rule sets of rationalize, so the
// expanded polynomial x^2 + 3*x + 2 became (x + 1) * (x + 2) again before polyToCanonical read it.
// Expected texts are the mathjs 15.2.0 output.

const rat = (input: string): string => String(rationalize(input));

describe('#1177 rationalize of a product of sums', () => {
  it('(x+1)*(x+2) is x ^ 2 + 3 * x + 2', () => {
    expect(rat('(x+1)*(x+2)')).toBe('x ^ 2 + 3 * x + 2');
  });
  it('(x+1)*(x-1) is x ^ 2 - 1', () => {
    expect(rat('(x+1)*(x-1)')).toBe('x ^ 2 - 1');
  });
  it('(x-1)*(x-2) is x ^ 2 - 3 * x + 2', () => {
    expect(rat('(x-1)*(x-2)')).toBe('x ^ 2 - 3 * x + 2');
  });
  it('(x+1)*(x+2)*(x+3) is x ^ 3 + 6 * x ^ 2 + 11 * x + 6', () => {
    expect(rat('(x+1)*(x+2)*(x+3)')).toBe('x ^ 3 + 6 * x ^ 2 + 11 * x + 6');
  });
  it('(x+1)*(x-1)*(x+2) is x ^ 3 + 2 * x ^ 2 - x - 2', () => {
    expect(rat('(x+1)*(x-1)*(x+2)')).toBe('x ^ 3 + 2 * x ^ 2 - x - 2');
  });
  it('a polynomial that is already expanded keeps its text', () => {
    expect(rat('x^2+3*x+2')).toBe('x ^ 2 + 3 * x + 2');
  });
});

describe('simplify with the default rules still factors a quadratic', () => {
  it('x^2+3*x+2 is (x + 1) * (x + 2)', () => {
    expect(String(simplify('x^2+3*x+2'))).toBe('(x + 1) * (x + 2)');
  });
  it('the default rules passed by the caller give the same form', () => {
    const rules = (simplify as unknown as { rules: unknown[] }).rules;
    const withRules = simplify as unknown as (expr: string, rules: unknown[]) => unknown;
    expect(String(withRules('x^2+3*x+2', rules))).toBe('(x + 1) * (x + 2)');
  });
  it('a rule set of the caller is applied as it is', () => {
    const withRules = simplify as unknown as (expr: string, rules: unknown[]) => unknown;
    expect(String(withRules('x^2+3*x+2', ['n1*n2 -> n2*n1']))).not.toContain('(x + 1)');
  });
});
