import { describe, it, expect } from 'vitest';
import { evaluate, parse } from '../src/factories/evaluate.js';

describe('G22 dogfood — expression lexer, sandbox, overflow', () => {
  it('#720 evaluate("π") matches Math.PI and sin(π/2)', () => {
    expect(evaluate('π')).toBe(Math.PI);
    expect(evaluate('sin(π/2)')).toBeCloseTo(1, 12);
    expect(parse('π').toString()).toBe('π');
  });

  it('#720 parse and evaluate √2 as sqrt(2)', () => {
    expect(evaluate('√2')).toBeCloseTo(Math.SQRT2, 12);
    expect(evaluate('√(3 + 1)')).toBe(2);
  });

  it('#809 huge integer and 1e309 literals throw Numeric overflow', () => {
    expect(() => evaluate('1e309')).toThrow(/Numeric overflow/);
    expect(() => evaluate('9'.repeat(400))).toThrow(/Numeric overflow/);
    expect(() => parse('9'.repeat(400))).toThrow(/Numeric overflow/);
    expect(evaluate('1e308')).toBe(1e308);
  });

  it('#808 safe evaluate does not expose parse/typed; typed() is forbidden', () => {
    expect(() => evaluate('parse')).toThrow(/Undefined symbol "parse"/);
    expect(() => evaluate('typed')).toThrow(/Undefined symbol "typed"/);
    expect(() => evaluate('compile')).toThrow(/Undefined symbol "compile"/);
    expect(() => evaluate('typed({"number": sin})')).toThrow(/forbidden function "typed"/);
    expect(() => evaluate('parse("1+1")')).toThrow(/forbidden function "parse"/);
    const parsed = evaluate('parse("1+1")', {}, { unsafe: true }) as {
      isOperatorNode?: boolean;
      toString(): string;
    };
    expect(parsed.isOperatorNode).toBe(true);
    expect(parsed.toString()).toBe('1 + 1');
  });

  it('#725 assignment requires unsafe; default evaluate rejects', () => {
    expect(parse('f(x) = x^2').toTex()).toContain('x');
    expect(() => evaluate('f(x)=x^2; f(3)')).toThrow(/disabled.*unsafe: true/);
    expect(evaluate('f(x)=x^2; f(3)', {}, { unsafe: true })).toBe(9);
  });
});
