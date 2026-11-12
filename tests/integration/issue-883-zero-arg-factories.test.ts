import { describe, it, expect } from 'vitest';
import { createParse } from '@danielsimonjr/mathts-parser';
import { createEvaluate } from '@danielsimonjr/mathts-evaluator';
import { createHelpClass, defaultMathScope } from '@danielsimonjr/mathts-expression';

/**
 * Issue #883: `createParse()` and `createEvaluate()` threw with zero arguments.
 * The public factories must resolve the parse and the math scope they need.
 */
describe('#883 zero-argument factories from the package entries', () => {
  it('#883 createParse() returns a parse function that parses 2+3', () => {
    const parse = createParse();
    expect(parse('2+3').toString()).toBe('2 + 3');
  });

  it('#883 createEvaluate() evaluates 2+3 with the default parse and scope', () => {
    const evaluate = createEvaluate();
    expect(evaluate('2+3')).toBe(5);
  });

  it('#883 createEvaluate(parse, defaultMathScope) evaluates 2+3 from explicit pieces', () => {
    const evaluate = createEvaluate(createParse(), defaultMathScope);
    expect(evaluate('2+3')).toBe(5);
  });

  it('#883 createHelpClass() resolves its evaluate dependency from the package', () => {
    const Help = createHelpClass();
    expect(typeof Help).toBe('function');
  });

  it('#883 createEvaluate keeps a caller-supplied parse function', () => {
    const seen: string[] = [];
    const callerParse = (expr: string) => {
      seen.push(expr);
      return createParse()(expr);
    };
    const evaluate = createEvaluate(callerParse);
    expect(evaluate('2+3')).toBe(5);
    expect(seen).toEqual(['2+3']);
  });
});
