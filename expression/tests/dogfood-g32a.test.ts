import { describe, it, expect } from 'vitest';
import { parse, evaluate, compileExpr } from '@danielsimonjr/mathts-functions';

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
    expect(() => evaluate('globalThis', { globalThis } as Record<string, unknown>)).toThrow(
      /host object/
    );
    expect(() => evaluate('Function', { Function } as Record<string, unknown>)).toThrow(
      /host object/
    );
    expect(() => evaluate('proto', { proto: Object.prototype } as Record<string, unknown>)).toThrow(
      /host object/
    );
    expect(() =>
      evaluate('proto', { proto: Function.prototype } as Record<string, unknown>)
    ).toThrow(/host object/);
    expect(() => evaluate('f()', { f: () => process } as Record<string, unknown>)).toThrow(
      /host object/
    );
    expect(() => evaluate('f()', { f: () => Function } as Record<string, unknown>)).toThrow(
      /host object/
    );
    expect(() => evaluate('f()', { f: () => globalThis } as Record<string, unknown>)).toThrow(
      /host object/
    );
    expect(() => evaluate('p.cwd()', { p: process } as Record<string, unknown>)).toThrow(
      /No access to method/
    );
    expect(() => evaluate('p.binding("fs")', { p: process } as Record<string, unknown>)).toThrow(
      /No access/
    );
    expect(() => evaluate('p.env', { p: process } as Record<string, unknown>)).toThrow(/No access/);
    expect(() => evaluate('p[0]', { p: process } as Record<string, unknown>)).toThrow(
      /No access to host object/
    );
    expect(() => compileExpr('process').evaluate({ process } as Record<string, unknown>)).toThrow(
      /host object/
    );
    // Math exports stay; a spoofed brand cannot hide a host reference.
    expect(typeof evaluate('min')).toBe('function');
    expect(() =>
      evaluate('f()', {
        f: () => ({ constructor: { name: 'DenseMatrix' }, leak: process }),
      } as Record<string, unknown>)
    ).toThrow(/host object/);
    const leaked = (): string => 'leaked';
    const inherited = Object.create({ parse: leaked }) as Record<string, unknown>;
    expect(evaluate('parse', inherited)).toBe(leaked);
    expect(() => evaluate('parse("1+1")')).toThrow(/forbidden function "parse"/);
    expect(() => evaluate('typed')).toThrow(/Undefined symbol "typed"/);
    expect(() => evaluate('createUnit')).toThrow(/Undefined symbol "createUnit"/);
    expect(() => evaluate('resolve')).toThrow(/Undefined symbol "resolve"/);
    // `chain` the function is denylisted; the surveyor's-chain unit stays.
    expect(typeof evaluate('chain')).not.toBe('function');
    expect(() => evaluate('simplify')).toThrow(/Undefined symbol "simplify"/);
    expect(() => evaluate('derivative')).toThrow(/Undefined symbol "derivative"/);
    expect(() => evaluate('FunctionNode')).toThrow(/Undefined symbol "FunctionNode"/);
  });

  it('#722 nesting limit 125 parses', () => {
    const depth = 125;
    const expr = '('.repeat(depth) + '1' + ')'.repeat(depth);
    expect(evaluate(expr)).toBe(1);
    const tooDeep = '('.repeat(126) + '1' + ')'.repeat(126);
    expect(() => parse(tooDeep)).toThrow(/nesting limit/);
  });

  it('#818 object literal skips forbidden keys', () => {
    const out = evaluate('{ secret: 42, constructor: 1, __proto__: 2 }') as unknown as Record<
      string,
      unknown
    >;
    expect(out).toEqual({ secret: 42 });
  });
});
