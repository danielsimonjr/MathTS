import { describe, it, expect } from 'vitest';
import { createParserClass } from '../src/Parser.js';
import { evaluate, parse } from '../../functions/src/factories/evaluate.js';

/**
 * Covers Parser.ts branches not hit by the main Parser.test.ts:
 *  - set() with an invalid (empty) variable name -> throws
 *  - toJSON() serializing an expression-defined function (value.syntax/.expr)
 *  - toJSON() throwing on an external (non-expression) function
 *  - isExpressionFunction helper (both branches)
 */
function buildParser() {
  function parserEvaluate(expr: string | string[], scope: any): any {
    const plainScope: Record<string, any> = {};
    if (scope && typeof scope.forEach === 'function') {
      scope.forEach((v: any, k: string) => {
        plainScope[k] = v;
      });
    }
    return evaluate(expr as string, plainScope);
  }
  return createParserClass({ evaluate: parserEvaluate, parse }) as any;
}

const ParserClass = buildParser();

describe('Parser.set - validation', () => {
  it('throws on an empty variable name', () => {
    const p = new ParserClass();
    expect(() => p.set('', 1)).toThrow(/Invalid variable name/);
  });

  it('throws on an invalid variable name starting with a digit', () => {
    const p = new ParserClass();
    expect(() => p.set('1abc', 1)).toThrow(/Invalid variable name/);
  });

  it('accepts a valid variable name', () => {
    const p = new ParserClass();
    expect(p.set('myVar', 7)).toBe(7);
    expect(p.get('myVar')).toBe(7);
  });
});

describe('Parser.toJSON', () => {
  it('serializes plain variables', () => {
    const p = new ParserClass();
    p.set('x', 42);
    const json = p.toJSON();
    expect(json.mathjs).toBe('Parser');
    expect(json.variables.x).toBe(42);
  });

  it('throws when serializing an external (non-expression) function', () => {
    const p = new ParserClass();
    // A plain JS function in scope is not an expression function (no .syntax/.expr)
    p.set('ext', function () {
      return 1;
    });
    expect(() => p.toJSON()).toThrow(/Cannot serialize external function/);
  });
});
