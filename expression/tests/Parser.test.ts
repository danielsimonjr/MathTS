import { describe, it, expect } from 'vitest';
import { createParserClass } from '../src/Parser.js';
// Use the fully bootstrapped evaluate and parse from functions
import { evaluate, parse } from '../../functions/src/factories/evaluate.js';

// ─── Bootstrap the Parser class ───────────────────────────────────────────────
// createParserClass needs 'evaluate' (that takes a scope) and 'parse'.
// We use the fully instantiated versions from functions/factories/evaluate.

// The evaluate function from factories takes (expr, scope?) and we need a
// scope-aware evaluate for the Parser. Wrap to match signature.
function scopedEvaluate(expr: string | string[], scope: Map<string, any>): any {
  // Convert Map to plain object for evaluate
  const plainScope: Record<string, any> = {};
  scope.forEach((v, k) => {
    plainScope[k] = v;
  });
  return evaluate(expr as string, plainScope);
}

// Actually, Parser.prototype.evaluate calls `evaluate(expr, this.scope)`
// where this.scope is a Map. The createEvaluate wrapping in evaluate.ts
// uses compile() which uses ObjectWrappingMap internally.
// Let's use the createParserClass from the functions package directly
// since it already has proper wiring.
// We'll fall back to using a manually-wired Parser using the expression package.

// Build a Parser class with minimal but real evaluate + parse wiring.
// The evaluate used by Parser just needs to forward to scope.
// We create a thin wrapper evaluate that accepts (expr, scope:Map).
function buildParser() {
  // evaluate for Parser: accepts (expr, scope) where scope is a Map
  // The Parser passes `this.scope` (a Map) to evaluate.
  // We need to handle this properly.
  function parserEvaluate(expr: string | string[], scope: any): any {
    // Convert scope Map to plain object
    const plainScope: Record<string, any> = {};
    if (scope && typeof scope.forEach === 'function') {
      scope.forEach((v: any, k: string) => {
        plainScope[k] = v;
      });
    }
    return evaluate(expr as string, plainScope);
  }

  const Parser = createParserClass({ evaluate: parserEvaluate, parse });
  return Parser;
}

const ParserClass = buildParser();

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('Parser - constructor', () => {
  it('creates a Parser instance with new', () => {
    const p = new (ParserClass as any)();
    expect(p).toBeTruthy();
    expect(p.isParser).toBe(true);
    expect(p.type).toBe('Parser');
  });

  it('throws when called without new', () => {
    expect(() => (ParserClass as any)()).toThrow(SyntaxError);
  });

  it('has an empty scope initially', () => {
    const p = new (ParserClass as any)();
    expect(p.scope).toBeTruthy();
    expect(p.scope.size).toBe(0);
  });

  it('scope is a Map', () => {
    const p = new (ParserClass as any)();
    expect(p.scope instanceof Map).toBe(true);
  });
});

// ─── evaluate method ─────────────────────────────────────────────────────────

describe('Parser - evaluate', () => {
  it('evaluates a constant expression', () => {
    const p = new (ParserClass as any)();
    const result = p.evaluate('2 + 3');
    expect(result).toBe(5);
  });

  it('evaluates a multiplication expression', () => {
    const p = new (ParserClass as any)();
    expect(p.evaluate('6 * 7')).toBe(42);
  });

  it('evaluates using values previously set', () => {
    const p = new (ParserClass as any)();
    p.set('x', 10);
    const result = p.evaluate('x * 2');
    expect(result).toBe(20);
  });

  it('evaluates expressions involving pi', () => {
    const p = new (ParserClass as any)();
    const result = p.evaluate('pi');
    expect(result).toBeCloseTo(Math.PI);
  });
});

// ─── get / set ────────────────────────────────────────────────────────────────

describe('Parser - get and set', () => {
  it('set stores a value and get retrieves it', () => {
    const p = new (ParserClass as any)();
    p.set('myVar', 42);
    expect(p.get('myVar')).toBe(42);
  });

  it('get returns undefined for non-existent variable', () => {
    const p = new (ParserClass as any)();
    expect(p.get('nonExistent')).toBeUndefined();
  });

  it('set returns the value', () => {
    const p = new (ParserClass as any)();
    const returned = p.set('y', 99);
    expect(returned).toBe(99);
  });

  it('overwrites existing variable', () => {
    const p = new (ParserClass as any)();
    p.set('z', 5);
    p.set('z', 10);
    expect(p.get('z')).toBe(10);
  });

  it('stores a function', () => {
    const p = new (ParserClass as any)();
    const fn = (x: number) => x * 2;
    p.set('double', fn);
    expect(p.get('double')).toBe(fn);
  });

  it('throws for invalid variable name containing a space', () => {
    const p = new (ParserClass as any)();
    expect(() => p.set('my var', 5)).toThrow();
  });

  it('throws for invalid variable name starting with a digit', () => {
    const p = new (ParserClass as any)();
    expect(() => p.set('1invalid', 5)).toThrow();
  });

  it('accepts names with underscore prefix', () => {
    const p = new (ParserClass as any)();
    p.set('_myVar', 7);
    expect(p.get('_myVar')).toBe(7);
  });

  it('accepts names with dollar sign', () => {
    const p = new (ParserClass as any)();
    p.set('$count', 3);
    expect(p.get('$count')).toBe(3);
  });

  it('accepts names with digits after the first char', () => {
    const p = new (ParserClass as any)();
    p.set('x2', 100);
    expect(p.get('x2')).toBe(100);
  });
});

// ─── getAll / getAllAsMap ──────────────────────────────────────────────────────

describe('Parser - getAll and getAllAsMap', () => {
  it('getAll returns an empty object initially', () => {
    const p = new (ParserClass as any)();
    expect(p.getAll()).toEqual({});
  });

  it('getAll returns all set variables as a plain object', () => {
    const p = new (ParserClass as any)();
    p.set('a', 1);
    p.set('b', 2);
    const all = p.getAll();
    expect(all.a).toBe(1);
    expect(all.b).toBe(2);
  });

  it('getAllAsMap returns the underlying Map', () => {
    const p = new (ParserClass as any)();
    p.set('x', 99);
    const map = p.getAllAsMap();
    expect(map instanceof Map).toBe(true);
    expect(map.get('x')).toBe(99);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('Parser - remove', () => {
  it('removes a variable from scope', () => {
    const p = new (ParserClass as any)();
    p.set('temp', 123);
    expect(p.get('temp')).toBe(123);
    p.remove('temp');
    expect(p.get('temp')).toBeUndefined();
  });

  it('removing a non-existent variable does not throw', () => {
    const p = new (ParserClass as any)();
    expect(() => p.remove('nonExistent')).not.toThrow();
  });

  it('removing one variable does not affect others', () => {
    const p = new (ParserClass as any)();
    p.set('keep', 1);
    p.set('del', 2);
    p.remove('del');
    expect(p.get('keep')).toBe(1);
    expect(p.get('del')).toBeUndefined();
  });
});

// ─── clear ────────────────────────────────────────────────────────────────────

describe('Parser - clear', () => {
  it('clears all variables from scope', () => {
    const p = new (ParserClass as any)();
    p.set('a', 1);
    p.set('b', 2);
    p.set('c', 3);
    p.clear();
    expect(p.getAll()).toEqual({});
  });

  it('after clear, get returns undefined', () => {
    const p = new (ParserClass as any)();
    p.set('x', 5);
    p.clear();
    expect(p.get('x')).toBeUndefined();
  });

  it('scope is empty after clear', () => {
    const p = new (ParserClass as any)();
    p.set('x', 5);
    p.clear();
    expect(p.scope.size).toBe(0);
  });
});

// ─── Multiple parsers ─────────────────────────────────────────────────────────

describe('Parser - independent scopes', () => {
  it('two parsers have independent scopes', () => {
    const p1 = new (ParserClass as any)();
    const p2 = new (ParserClass as any)();
    p1.set('x', 10);
    p2.set('x', 20);
    expect(p1.get('x')).toBe(10);
    expect(p2.get('x')).toBe(20);
  });

  it('clear on one does not affect the other', () => {
    const p1 = new (ParserClass as any)();
    const p2 = new (ParserClass as any)();
    p1.set('shared', 5);
    p2.set('shared', 5);
    p1.clear();
    expect(p2.get('shared')).toBe(5);
  });
});

// ─── toJSON / fromJSON ────────────────────────────────────────────────────────

describe('Parser - toJSON and fromJSON', () => {
  it('toJSON serializes variables', () => {
    const p = new (ParserClass as any)();
    p.set('a', 42);
    p.set('b', 'hello');
    const json = p.toJSON();
    expect(json.mathjs).toBe('Parser');
    expect(json.variables.a).toBe(42);
    expect(json.variables.b).toBe('hello');
  });

  it('toJSON produces empty variables and functions for empty parser', () => {
    const p = new (ParserClass as any)();
    const json = p.toJSON();
    expect(json.mathjs).toBe('Parser');
    expect(json.variables).toEqual({});
    expect(json.functions).toEqual({});
  });

  it('fromJSON restores variable state', () => {
    const json = { variables: { x: 10, y: 20 }, functions: {} };
    const p = (ParserClass as any).fromJSON(json);
    expect(p.get('x')).toBe(10);
    expect(p.get('y')).toBe(20);
  });

  it('fromJSON returns a valid Parser instance', () => {
    const json = { variables: { n: 5 }, functions: {} };
    const p = (ParserClass as any).fromJSON(json);
    expect(p.isParser).toBe(true);
  });
});
