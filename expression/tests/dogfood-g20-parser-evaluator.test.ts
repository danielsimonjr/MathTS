import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse, evaluate, compileExpression, createParse } from '../src/index.js';

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

  it('#796 compileExpression("2+3")() === 5 and .evaluate() === 5', () => {
    const compiled = compileExpression('2+3');
    expect(compiled()).toBe(5);
    expect(compiled.evaluate()).toBe(5);
  });

  it('factory compileExpression(parseFn, scope, expr) still evaluates', () => {
    const compiled = compileExpression(
      (expr) => parse(expr),
      { add: (a: number, b: number) => a + b },
      '2+3'
    );
    expect(compiled.evaluate()).toBe(5);
  });

  it('createParse remains a factory, not the ready-to-call parse', () => {
    expect(typeof createParse).toBe('function');
    expect(createParse.length).toBeGreaterThan(0);
  });

  it('safe scope hides compiler symbols, including inside a nested expression', () => {
    for (const name of [
      'parse',
      'typed',
      'compile',
      'import',
      'createUnit',
      'evaluate',
      'resolve',
      'chain',
      'simplify',
      'derivative',
      'parser',
      'help',
      'ConstantNode',
      'FunctionNode',
    ]) {
      expect(() => evaluate(name), name).toThrow(new RegExp(`Undefined symbol "${name}"`));
    }
    expect(() => evaluate('typed({"number": sin})')).toThrow(/forbidden function "typed"/);
    expect(() => evaluate('parse("1+1")')).toThrow(/forbidden function "parse"/);
    expect(() => evaluate('resolve("1+1", {})')).toThrow(/Undefined function "resolve"/);
    expect(() => evaluate('map([1], x ? parse : 0)')).toThrow(/Undefined symbol "?parse"?/);
    expect(() => evaluate('filter([1], x ? typed : 0)')).toThrow(/Undefined symbol "?typed"?/);
    expect(() => evaluate('map([1], x ? createUnit : 0)')).toThrow(
      /Undefined symbol "?createUnit"?/
    );
    expect(() => evaluate('sin.constructor')).toThrow(/No access to property "constructor"/);
    expect(() => evaluate('({a:1})["constructor"]')).toThrow(/No access to property "constructor"/);
  });

  it('assignment and function definitions require { unsafe: true }', () => {
    expect(() => evaluate('a = 4')).toThrow(/unsafe: true/);
    expect(() => evaluate('f(x) = x + 1')).toThrow(/unsafe: true/);
    const scope: Record<string, unknown> = {};
    expect(evaluate('a = 4', scope, { unsafe: true })).toBe(4);
    expect(scope.a).toBe(4);
    expect(evaluate('f(x) = x + 1; f(3)', {}, { unsafe: true })).toBe(4);
  });

  it('numeric overflow throws; 1e308 and Infinity stay', () => {
    expect(() => evaluate('1e309')).toThrow(SyntaxError);
    expect(() => evaluate('1e309')).toThrow(/Numeric overflow/);
    expect(() => parse('9'.repeat(400))).toThrow(/Numeric overflow/);
    expect(() => evaluate('1' + '0'.repeat(400) + '.5')).toThrow(/Numeric overflow/);
    expect(evaluate('1e308')).toBe(1e308);
    expect(evaluate('Infinity')).toBe(Infinity);
  });

  it('π and √ use the same lexer as the functions evaluator', () => {
    expect(evaluate('π')).toBe(Math.PI);
    expect(evaluate('√4')).toBe(2);
    expect(evaluate('sin(π / 2)')).toBeCloseTo(1, 12);
  });

  it('README shows the ready-to-call entry and the sandbox', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    expect(readme).toContain("from '@danielsimonjr/mathts-expression'");
    expect(readme).toContain("evaluate('2+3')");
    expect(readme).toContain("compileExpression('2+3')()");
    expect(readme).toContain('unsafe: true');
    expect(readme).toContain('@danielsimonjr/mathts-functions');
  });
});
