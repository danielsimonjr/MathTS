import { describe, it, expect } from 'vitest';
import { parse, evaluate } from '@danielsimonjr/mathts-functions';

/** Issue #885: a Unicode radical parses as a function call, not as a postfix operator. */
describe('#885 Unicode radical parses as sqrt(...)', () => {
  it('parse("√2").toString() is sqrt(2) and toTex() is \\sqrt{2}', () => {
    const node = parse('√2');
    expect(node.toString()).toBe('sqrt(2)');
    expect(node.toTex()).toBe('\\sqrt{2}');
    expect(evaluate('√2')).toBeCloseTo(Math.SQRT2, 15);
  });

  it('√(2) has the same tree as √2', () => {
    expect(parse('√(2)').toString()).toBe('sqrt(2)');
    expect(parse('√(x+1)').toString()).toBe(parse('sqrt(x+1)').toString());
    expect(evaluate('√(x+1)', { x: 3 })).toBe(2);
  });

  it('∛ and ∜ are cbrt and the fourth root', () => {
    expect(parse('∛8').toString()).toBe('cbrt(8)');
    expect(evaluate('∛8')).toBe(2);
    expect(evaluate('∜16')).toBeCloseTo(2, 12);
  });
});

/** Issue #922: a Unicode mathematical digit is a parse-time syntax error, never a symbol. */
describe('#922 Unicode mathematical digit is rejected at parse time', () => {
  it('parse("𝟙") throws the same error that evaluate("𝟙") throws', () => {
    expect(() => parse('𝟙')).toThrow(SyntaxError);
    expect(() => evaluate('𝟙')).toThrow(SyntaxError);
    expect(() => evaluate('𝟙')).toThrow(/Unicode mathematical digit "𝟙" is not allowed/);
  });

  it('parse("𝟙+1") throws, so no symbol reaches evaluate', () => {
    expect(() => parse('𝟙+1')).toThrow(SyntaxError);
    expect(() => evaluate('𝟙+1')).toThrow(SyntaxError);
  });
});

describe('radical operand and implicit multiplication', () => {
  it('the operand is the unary operand', () => {
    expect(parse('√2^2').toString()).toBe('sqrt(2 ^ 2)');
    expect(parse('√(2)^2').toString()).toBe('sqrt(2 ^ 2)');
    expect(parse('√x!').toString()).toBe('sqrt(x!)');
    expect(evaluate('-√4')).toBe(-2);
    expect(evaluate('√√16')).toBe(2);
  });

  it('2√3 is a product', () => {
    expect(evaluate('2√9')).toBe(6);
    expect(evaluate('√4√9')).toBe(6);
  });

  it('√-4 is complex with the full math scope', () => {
    expect(String(evaluate('√-4'))).toBe('2i');
  });
});
