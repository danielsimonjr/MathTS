import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluate, parse, compileExpr } from '../src/factories/evaluate.js';

describe('G22 dogfood — expression lexer, sandbox, overflow', () => {
  it('#720 evaluate("π") matches Math.PI and sin(π/2)', () => {
    expect(evaluate('π')).toBe(Math.PI);
    expect(evaluate('sin(π/2)')).toBeCloseTo(1, 12);
    expect(parse('π').toString()).toBe('π');
  });

  it('#720 user scope wins for π and does not steal pi', () => {
    expect(evaluate('π', { π: 2 })).toBe(2);
    expect(evaluate('π', { pi: 2 })).toBe(Math.PI);
    expect(evaluate('pi', { pi: 2 })).toBe(2);
  });

  it('#720 parse and evaluate √2 as sqrt(2)', () => {
    expect(evaluate('√2')).toBeCloseTo(Math.SQRT2, 12);
    expect(evaluate('√(3 + 1)')).toBe(2);
    expect(evaluate('√4+5')).toBe(7);
  });

  it('#809 huge integer and 1e309 literals throw Numeric overflow', () => {
    expect(() => evaluate('1e309')).toThrow(SyntaxError);
    expect(() => evaluate('1e309')).toThrow(/Numeric overflow/);
    expect(() => evaluate('9'.repeat(400))).toThrow(/Numeric overflow/);
    expect(() => parse('9'.repeat(400))).toThrow(/Numeric overflow/);
    expect(() => evaluate('1' + '0'.repeat(400) + '.5')).toThrow(/Numeric overflow/);
    expect(() => parse('2e308')).toThrow(/Numeric overflow/);
    expect(evaluate('1e308')).toBe(1e308);
    expect(evaluate('1e-400')).toBe(0);
    expect(evaluate('Infinity')).toBe(Infinity);
  });

  it('#808 safe evaluate does not expose parse/typed; typed() is forbidden', () => {
    expect(() => evaluate('parse')).toThrow(/Undefined symbol "parse"/);
    expect(() => evaluate('typed')).toThrow(/Undefined symbol "typed"/);
    expect(() => evaluate('compile')).toThrow(/Undefined symbol "compile"/);
    expect(() => evaluate('import')).toThrow(/Undefined symbol "import"/);
    expect(() => evaluate('createUnit')).toThrow(/Undefined symbol "createUnit"/);
    expect(() => evaluate('evaluate')).toThrow(/Undefined symbol "evaluate"/);
    expect(() => evaluate('Function')).toThrow(/Undefined symbol "Function"/);
    expect(() => evaluate('constructor')).toThrow(/Undefined symbol "constructor"/);
    expect(() => evaluate('typed({"number": sin})')).toThrow(/forbidden function "typed"/);
    expect(() => evaluate('parse("1+1")')).toThrow(/forbidden function "parse"/);
    expect(() => evaluate('resolve("1+1", {})')).toThrow(/Undefined function "resolve"/);
    const parsed = evaluate('parse("1+1")', {}, { unsafe: true }) as {
      isOperatorNode?: boolean;
      toString(): string;
    };
    expect(parsed.isOperatorNode).toBe(true);
    expect(parsed.toString()).toBe('1 + 1');
    expect(typeof evaluate('typed', {}, { unsafe: true })).toBe('function');
    const typedSin = evaluate('typed({"number": sin})', {}, { unsafe: true }) as unknown as (
      x: number
    ) => number;
    expect(typedSin(0)).toBe(0);
    const compiled = compileExpr('parse("1+1")', { unsafe: true });
    expect((compiled.evaluate() as { toString(): string }).toString()).toBe('1 + 1');
  });

  it('#808 map and filter callbacks cannot load or call the live parser', () => {
    expect(() => evaluate('map([1], x ? parse : 0)')).toThrow(/Undefined symbol parse/);
    expect(() => evaluate('map([1], x ? parse : 0)[1]("1+1")')).toThrow(/Undefined symbol parse/);
    expect(() => evaluate('map([1], x ? typed : 0)')).toThrow(/Undefined symbol typed/);
    expect(() => evaluate('map([1], x ? createUnit : 0)')).toThrow(/Undefined symbol createUnit/);
    expect(() => evaluate('filter([1], x ? parse : 0)')).toThrow(/Undefined symbol parse/);
    expect(() => evaluate('({a:1})["constructor"]')).toThrow(/No access to property "constructor"/);
    expect(() => evaluate('({a:1})["\\u0063onstructor"]')).toThrow(
      /No access to property "constructor"/
    );
    expect(() => evaluate('sin.constructor')).toThrow(/No access to property "constructor"/);
    expect(() => evaluate('\u03C1arse')).toThrow(/Undefined symbol/);
    const leaked = (): string => 'leaked';
    const inherited = Object.create({ parse: leaked }) as Record<string, unknown>;
    expect(evaluate('parse', inherited)).toBe(leaked);
    expect(() => evaluate('parse', {})).toThrow(/Undefined symbol "parse"/);
    expect(() => evaluate('constructor', { constructor: leaked })).toThrow(
      /Undefined symbol "constructor"/
    );
  });

  it('#808 documented safe functions still evaluate', () => {
    expect(evaluate('sqrt(4)')).toBe(2);
    expect(evaluate('sin(pi / 2)')).toBeCloseTo(1, 12);
    const mapped = evaluate('map([1, 2, 3], x * 2)') as unknown as { toArray(): number[] };
    expect(mapped.toArray()).toEqual([2, 4, 6]);
  });

  it('#725 assignment requires unsafe; default evaluate rejects', () => {
    expect(parse('f(x) = x^2').toTex()).toContain('x');
    expect(() => evaluate('f(x)=x^2; f(3)')).toThrow(/disabled.*unsafe: true/);
    expect(evaluate('f(x)=x^2; f(3)', {}, { unsafe: true })).toBe(9);
  });

  it('#793 and #725 expression README sample imports parse and documents unsafe', () => {
    const readme = readFileSync(new URL('../../expression/README.md', import.meta.url), 'utf8');
    expect(readme).toContain("import { parse, evaluate } from '@danielsimonjr/mathts-functions'");
    expect(readme).toContain('@danielsimonjr/mathts-functions');
    expect(readme).toContain('unsafe: true');
    const node = parse('c = 1 / sqrt(eps0 * mu0)');
    expect(node.toString()).toBe('c = 1 / sqrt(eps0 * mu0)');
    expect(node.toTex()).toContain('eps0');
  });
});
