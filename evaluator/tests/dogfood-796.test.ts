import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as evaluator from '../src/index.js';

/** Issue #796 — evaluator package exposes working evaluate / compileExpression. */
describe('#796 mathts-evaluator standalone', () => {
  it('exports evaluate', () => {
    expect(typeof evaluator.evaluate).toBe('function');
    expect(evaluator.evaluate('2+3')).toBe(5);
  });

  it('compileExpression("2+3")() === 5', () => {
    const compiled = evaluator.compileExpression('2+3');
    expect(compiled()).toBe(5);
    expect(compiled.evaluate()).toBe(5);
  });

  it('factory compileExpression(parseFn, scope, expr) still works', () => {
    const compiled = evaluator.compileExpression(
      (expr: string) => evaluator.parse(expr),
      { add: (a: number, b: number) => a + b },
      '2+3'
    );
    expect(compiled.evaluate()).toBe(5);
  });

  it('safe scope hides compiler symbols; assignment needs unsafe; overflow throws', () => {
    expect(() => evaluator.evaluate('parse')).toThrow(/Undefined symbol "parse"/);
    expect(() => evaluator.evaluate('typed')).toThrow(/Undefined symbol "typed"/);
    expect(() => evaluator.evaluate('createUnit')).toThrow(/Undefined symbol "createUnit"/);
    expect(() => evaluator.evaluate('resolve')).toThrow(/Undefined symbol "resolve"/);
    expect(() => evaluator.evaluate('chain')).toThrow(/Undefined symbol "chain"/);
    expect(() => evaluator.evaluate('simplify')).toThrow(/Undefined symbol "simplify"/);
    expect(() => evaluator.evaluate('derivative')).toThrow(/Undefined symbol "derivative"/);
    expect(() => evaluator.evaluate('parse("1+1")')).toThrow(/forbidden function "parse"/);
    expect(() => evaluator.evaluate('map([1], x ? parse : 0)')).toThrow(
      /Undefined symbol "?parse"?/
    );
    expect(() => evaluator.evaluate('filter([1], x ? typed : 0)')).toThrow(
      /Undefined symbol "?typed"?/
    );
    expect(() => evaluator.evaluate('a = 1')).toThrow(/unsafe: true/);
    expect(evaluator.evaluate('a = 1', {}, { unsafe: true })).toBe(1);
    expect(() => evaluator.evaluate('1e309')).toThrow(/Numeric overflow/);
    expect(evaluator.evaluate('√4')).toBe(2);
  });

  it('Object.keys includes evaluate', () => {
    expect(Object.keys(evaluator).sort()).toContain('evaluate');
  });

  it('README shows the callable compile and the sandbox', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    expect(readme).toContain("from '@danielsimonjr/mathts-evaluator'");
    expect(readme).toContain("compileExpression('2+3')()");
    expect(readme).toContain('unsafe: true');
    expect(readme).toContain('does not import');
  });
});
