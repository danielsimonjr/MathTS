import { describe, it, expect } from 'vitest';
import { createParse } from '@danielsimonjr/mathts-parser';
import { createEvaluate } from '@danielsimonjr/mathts-evaluator';
import {
  createHelpClass,
  createSymbolNode,
  defaultMathScope,
} from '@danielsimonjr/mathts-expression';

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

  it('#883 createParse() builds nodes that print and evaluate as the default parse does', () => {
    const parse = createParse();
    // A number constant is bounded: toTex must not print it as infinity.
    expect(parse('2+3').toTex()).toBe('2+3');
    // A block of statements returns a result set.
    expect(parse('1\n2').compile().evaluate({}).valueOf()).toEqual([1, 2]);
  });

  it('#883 a node constructor built on a caller math scope compiles against that scope', () => {
    const SymbolNode = createSymbolNode({ math: { foo: 42 } });
    expect(new SymbolNode('foo').compile().evaluate()).toBe(42);
  });
});
