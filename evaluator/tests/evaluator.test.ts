import { describe, it, expect } from 'vitest';
import * as evaluator from '../src/index.js';

/**
 * Re-export of the compiler + evaluator from
 * `@danielsimonjr/mathts-expression`. These verify the re-exported symbols are
 * present and callable. Full evaluation behaviour (which needs a parser + math
 * scope wired in) is covered by the expression package's compile/evaluate tests.
 */
describe('@danielsimonjr/mathts-evaluator re-export surface', () => {
  it('exposes compile, createEvaluate, compileExpression', () => {
    expect(typeof evaluator.compile).toBe('function');
    expect(typeof evaluator.createEvaluate).toBe('function');
    expect(typeof evaluator.compileExpression).toBe('function');
  });

  it('createEvaluate builds an evaluate function', () => {
    const evaluate = evaluator.createEvaluate(((expr: string) => expr) as any, {});
    expect(typeof evaluate).toBe('function');
  });
});
