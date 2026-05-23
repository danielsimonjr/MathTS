/**
 * Smoke test for expression/src/evaluator/index.ts
 *
 * Asserts that the barrel re-exports `createEvaluate` and
 * `compileExpression` as functions.
 */
import { describe, it, expect } from 'vitest';
import * as evaluatorBarrel from '../src/evaluator/index.js';

describe('expression/src/evaluator/index.ts – barrel smoke test', () => {
  it('exports createEvaluate as a function', () => {
    expect(typeof evaluatorBarrel.createEvaluate).toBe('function');
  });

  it('exports compileExpression as a function', () => {
    expect(typeof evaluatorBarrel.compileExpression).toBe('function');
  });

  it('barrel contains exactly the two expected exports', () => {
    const keys = Object.keys(evaluatorBarrel);
    expect(keys).toContain('createEvaluate');
    expect(keys).toContain('compileExpression');
  });
});
