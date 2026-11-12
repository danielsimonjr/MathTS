import { describe, it, expect } from 'vitest';
import { parse, evaluate, compileExpression } from '../src/index.js';

/** Issues #715 #796 — thin parser/evaluator packages work standalone. */
describe('dogfood G20 default parse/evaluate', () => {
  it('#715 parse("2+2") returns an AST without factory bootstrap', () => {
    const node = parse('2+2');
    expect(node).toBeDefined();
    expect((node as { isOperatorNode?: boolean }).isOperatorNode).toBe(true);
  });

  it('#796 evaluate("2+3") === 5', () => {
    expect(evaluate('2+3')).toBe(5);
  });

  it('#796 compileExpression("2+3").evaluate() === 5', () => {
    expect(compileExpression('2+3').evaluate()).toBe(5);
  });
});
