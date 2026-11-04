import { describe, it, expect } from 'vitest';
import * as expression from '@danielsimonjr/mathts-expression';
import * as evaluator from '../src/index.js';

/**
 * Drift guard: `evaluator` re-exports the compile/evaluate half of
 * `expression`. If expression adds another compile/evaluate entry point, add it
 * to the facade and to this pinned list.
 */
const PINNED = ['compile', 'compileExpression', 'createEvaluate'];

describe('@danielsimonjr/mathts-evaluator facade sync with expression', () => {
  it('re-exports exactly the pinned compile/evaluate list', () => {
    expect(Object.keys(evaluator).sort()).toEqual(PINNED);
  });

  it('re-exports the same function objects (no copies)', () => {
    const e = expression as Record<string, unknown>;
    const v = evaluator as Record<string, unknown>;
    for (const name of PINNED) {
      expect(typeof e[name]).toBe('function');
      expect(v[name]).toBe(e[name]);
    }
  });

  it('expression exposes no other compile*/evaluate* value export missing here', () => {
    const candidates = Object.keys(expression).filter((k) =>
      /^(compile|createEvaluate|evaluate)/.test(k)
    );
    for (const name of candidates) expect(PINNED).toContain(name);
  });
});
