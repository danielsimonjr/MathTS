import { describe, it, expect } from 'vitest';
import * as evaluator from '../src/index.js';

/** Issue #796 — evaluator package exposes working evaluate / compileExpression. */
describe('#796 mathts-evaluator standalone', () => {
  it('exports evaluate', () => {
    expect(typeof evaluator.evaluate).toBe('function');
    expect(evaluator.evaluate('2+3')).toBe(5);
  });

  it('compileExpression("2+3") does not throw parseFn is not a function', () => {
    const compiled = evaluator.compileExpression('2+3');
    expect(compiled.evaluate()).toBe(5);
  });

  it('Object.keys includes evaluate', () => {
    expect(Object.keys(evaluator).sort()).toContain('evaluate');
  });
});
