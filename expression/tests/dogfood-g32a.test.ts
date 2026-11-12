import { describe, it, expect } from 'vitest';
import { parse, evaluate } from '@danielsimonjr/mathts-functions';

describe('dogfood G32a regressions', () => {
  it('#817 parse accepts block and line comments', () => {
    expect(evaluate('/* c */ 1')).toBe(1);
    expect(evaluate('// c\n1')).toBe(1);
    expect(evaluate('/* a */ /* b */ 2 + 3')).toBe(5);
  });

  it('#723 parse("1e") is SyntaxError', () => {
    expect(() => parse('1e')).toThrow(SyntaxError);
    expect(() => evaluate('1e')).toThrow(SyntaxError);
    expect(evaluate('1e3')).toBe(1000);
    expect(evaluate('1 e')).toBeCloseTo(Math.E, 12);
  });

  it('#816 evaluate does not return host objects by identity', () => {
    expect(() => evaluate('process')).toThrow(/Undefined symbol/);
    expect(() => evaluate('process', { process } as Record<string, unknown>)).toThrow(
      /host object/
    );
    expect(() => evaluate('p', { p: process } as Record<string, unknown>)).toThrow(/host object/);
  });

  it('#722 nesting limit 125 parses', () => {
    const depth = 125;
    const expr = '('.repeat(depth) + '1' + ')'.repeat(depth);
    expect(evaluate(expr)).toBe(1);
    const tooDeep = '('.repeat(126) + '1' + ')'.repeat(126);
    expect(() => parse(tooDeep)).toThrow(/nesting limit/);
  });

  it('#818 object literal skips forbidden keys', () => {
    const out = evaluate('{ secret: 42, constructor: 1, __proto__: 2 }') as Record<string, unknown>;
    expect(out).toEqual({ secret: 42 });
  });
});
