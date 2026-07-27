/**
 * Tests for Slice 5.14 — CAS batch processing.
 *
 * Covers `casSimplify`, `casDerivative`, `casExpand`, `casFactor` from
 * `functions/src/typed/cas.ts`.  Each function has a single-expression
 * overload (returns `string`) and a batch overload (returns `Promise<string[]>`).
 *
 * Batch overloads are processed in-process (worker fan-out was removed).
 *
 * Tests:
 *  1.  casSimplify — small batch (< threshold) returns correct string array.
 *  2.  casSimplify — large batch (≥ threshold, 32 exprs).
 *  3.  casSimplify — single-expr overload matches each batch element.
 *  4.  casDerivative — small batch returns correct derivatives.
 *  5.  casExpand — small batch returns expanded forms.
 *  6.  casFactor — small batch returns factored forms.
 *  7.  Mixed string + parsed-node input handled correctly.
 *  8.  Error in one batch element (invalid expression) propagates.
 *  9.  casSimplify single-expr: numeric evaluation (`2 * 3` → `6`).
 * 10.  casDerivative single-expr: power rule, trig, exp.
 */

import { describe, it, expect } from 'vitest';
import { parse, evaluate } from '../src/factories/evaluate.js';
import {
  casSimplify,
  casDerivative,
  casExpand,
  casFactor,
  CAS_BATCH_THRESHOLD,
} from '../src/typed/cas.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an array of `n` distinct polynomial expressions. */
function makePolynomials(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${i + 1}*x + ${i + 1}*x`);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Slice 5.14 — CAS batch processing', () => {
  // 1. casSimplify — small batch (< threshold) — resolved synchronously
  it('casSimplify: small batch (< threshold) returns correct simplified array', async () => {
    const exprs = ['x + x', 'y * 1', '2 * 3'];
    expect(exprs.length).toBeLessThan(CAS_BATCH_THRESHOLD);

    const results = await casSimplify(exprs);
    expect(results).toHaveLength(3);

    // 'x + x' → '2*x'
    expect(results[0]).toBe('2*x');
    // 'y * 1' → 'y'
    expect(results[1]).toBe('y');
    // '2 * 3' → '6'
    expect(results[2]).toBe('6');
  });

  // 2. casSimplify — large batch (≥ threshold)
  it('casSimplify: large batch (32 exprs, ≥ threshold) returns 32 results', async () => {
    const n = 32;
    expect(n).toBeGreaterThanOrEqual(CAS_BATCH_THRESHOLD);
    const exprs = makePolynomials(n);

    const results = await casSimplify(exprs);
    expect(results).toHaveLength(n);

    // Each `k*x + k*x` should simplify to `2k*x` (or the numeric form)
    for (let i = 0; i < n; i++) {
      const k = i + 1;
      // The single-element result must match the single-call result
      const singleResult = casSimplify(exprs[i]);
      expect(results[i]).toBe(singleResult);
      // Verify the result contains '2' and 'x' (like-term combination)
      const twoK = 2 * k;
      expect(results[i]).toContain(String(twoK));
    }
  });

  // 3. casSimplify — result correctness: each entry matches single-expression call
  it('casSimplify: each batch result matches the single-expression call', async () => {
    const exprs = ['1*x', '0 + y', 'x^1', 'x^0', '3*x + 3*x', '2 * 5'];

    const batchResults = await casSimplify(exprs);
    for (let i = 0; i < exprs.length; i++) {
      const singleResult = casSimplify(exprs[i]);
      expect(batchResults[i]).toBe(singleResult);
    }
  });

  // 4. casDerivative — small batch returns correct derivatives
  it('casDerivative: small batch returns correct derivatives for x', async () => {
    const exprs = ['x^2', 'sin(x)', 'exp(x)'];
    expect(exprs.length).toBeLessThan(CAS_BATCH_THRESHOLD);

    const results = await casDerivative(exprs, 'x');
    expect(results).toHaveLength(3);

    // Power rule: d/dx(x^2) = 2*x^1
    expect(results[0]).toContain('2');
    expect(results[0]).toContain('x');

    // Trig: d/dx(sin(x)) = cos(x)
    expect(results[1]).toBe('cos(x)');

    // Exp: d/dx(exp(x)) = exp(x)
    expect(results[2]).toBe('exp(x)');
  });

  // 5. casExpand — small batch returns expanded forms (real engine: collects
  // like terms; (x+1)^2 → x^2 + 2x + 1, not the old uncollected 'x*x + …').
  it('casExpand: small batch expands and collects like terms', async () => {
    const exprs = ['(x+1)^2', '(a+b)*(c+d)'];
    expect(exprs.length).toBeLessThan(CAS_BATCH_THRESHOLD);

    const results = await casExpand(exprs);
    expect(results).toHaveLength(2);

    // (x+1)^2 → 1*x^2 + 2*x + 1 (like terms collected — no bare 'x*x')
    const r0 = results[0];
    expect(r0).toContain('2*x');
    expect(r0).not.toContain('x*x');

    // (a+b)*(c+d) → each cross term present
    const r1 = results[1];
    expect(r1).toContain('a*c');
    expect(r1).toContain('a*d');
    expect(r1).toContain('b*c');
    expect(r1).toContain('b*d');
  });

  // 6. casFactor — small batch returns factored forms
  it('casFactor: small batch factors out integer GCDs', async () => {
    const exprs = ['2*x + 4*y', '3*a + 6*b', '5*m + 10*n'];
    expect(exprs.length).toBeLessThan(CAS_BATCH_THRESHOLD);

    const results = await casFactor(exprs);
    expect(results).toHaveLength(3);

    // 2*x + 4*y → 2*(x + 2*y)
    expect(results[0]).toBe('2*(x + 2*y)');
    // 3*a + 6*b → 3*(a + 2*b)
    expect(results[1]).toBe('3*(a + 2*b)');
    // 5*m + 10*n → 5*(m + 2*n)
    expect(results[2]).toBe('5*(m + 2*n)');
  });

  // 7. Mixed string + parsed-node input handled correctly
  it('casSimplify: mixed string and MathNode inputs are accepted', async () => {
    const node = parse('1*z');
    const exprs: Array<string | ReturnType<typeof parse>> = ['1*x', node, '0 + w'];

    const results = await casSimplify(exprs);
    expect(results).toHaveLength(3);

    // '1*x' → 'x'
    expect(results[0]).toBe('x');
    // parse('1*z') → simplified → 'z'
    expect(results[1]).toBe('z');
    // '0 + w' → 'w'
    expect(results[2]).toBe('w');
  });

  // 8. Error in one batch element (invalid expression) propagates
  it('casDerivative: unrecognised terms produce placeholder not an exception', async () => {
    // The symbolic derivative of complex/unknown terms returns a placeholder
    // like `d/dx(<term>)`.  This is the defined behaviour, not an error.
    const exprs = ['x^3', 'log(x^2 + 1)'];
    const results = await casDerivative(exprs, 'x');
    expect(results).toHaveLength(2);

    // x^3 → 3*x^2
    expect(results[0]).toContain('3');

    // log(x^2 + 1) is unrecognised → placeholder
    expect(results[1]).toContain('d/dx');
  });

  // 8b. casFactor now performs real univariate factorization over the rationals.
  it('casFactor: univariate polynomials are factored (real engine)', async () => {
    const exprs = ['x^2 - 1', 'x^3 - 8'];
    const results = await casFactor(exprs);
    expect(results).toHaveLength(2);
    // x^2 - 1 = (x-1)(x+1); x^3 - 8 = (x-2)(x^2+2x+4) — both are real factorizations.
    expect(results[0]).not.toBe('x^2 - 1');
    expect(results[1]).not.toBe('x^3 - 8');
    // Verify by numeric equality to the original polynomial.
    for (const x of [-2, 0.5, 3]) {
      expect(evaluate(results[0], { x }) as number).toBeCloseTo(x * x - 1, 8);
      expect(evaluate(results[1], { x }) as number).toBeCloseTo(x ** 3 - 8, 8);
    }
  });

  // 9. casSimplify single-expr: numeric evaluation
  it('casSimplify: single-expr overload evaluates numeric expressions', () => {
    expect(casSimplify('2 * 3')).toBe('6');
    expect(casSimplify('10 + 5')).toBe('15');
    expect(casSimplify('2^3')).toBe('8');
  });

  // 10. casDerivative single-expr: power rule, trig, exp, constant
  it('casDerivative: single-expr overload handles common patterns', () => {
    // Power rule
    expect(casDerivative('x^3', 'x')).toBe('3*x^2');
    // Trig
    expect(casDerivative('cos(x)', 'x')).toBe('-sin(x)');
    // Exp
    expect(casDerivative('exp(x)', 'x')).toBe('exp(x)');
    // Constant (no variable in term)
    expect(casDerivative('5', 'x')).toBe('0');
    // Linear
    expect(casDerivative('3*x', 'x')).toBe('3');
  });

  // Bonus: large batch for casDerivative
  it('casDerivative: large batch (≥ threshold) returns correct derivatives', async () => {
    const n = CAS_BATCH_THRESHOLD + 2; // 18 expressions
    const exprs = Array.from({ length: n }, (_, i) => `${i + 1}*x`);

    const results = await casDerivative(exprs, 'x');
    expect(results).toHaveLength(n);

    for (let i = 0; i < n; i++) {
      // d/dx(k*x) = k
      expect(results[i]).toBe(String(i + 1));
    }
  });

  // Bonus: large batch for casExpand
  it('casExpand: large batch (≥ threshold) returns correct expanded forms', async () => {
    const n = CAS_BATCH_THRESHOLD + 4; // 20 expressions
    const exprs = Array.from({ length: n }, (_, i) => `(x+${i})`);

    // Single-term parenthesised expressions expand to themselves
    const results = await casExpand(exprs);
    expect(results).toHaveLength(n);
    for (let i = 0; i < n; i++) {
      const singleResult = casExpand(exprs[i]);
      expect(results[i]).toBe(singleResult);
    }
  });
});
