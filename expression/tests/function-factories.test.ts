import { describe, it, expect } from 'vitest';
import { createCompile } from '../src/function/compile.js';
import { createEvaluate } from '../src/function/evaluate.js';
import { createParser } from '../src/function/parser.js';
import { createHelp } from '../src/function/help.js';

/**
 * The `function/` factories are mathjs-style typed-function wrappers. They call
 * `typed(name, { '<signature>': fn })` and expect back a dispatcher that picks
 * the implementation by runtime argument types. We provide a minimal `typed`
 * mock that dispatches on the JS types of the arguments, mirroring the
 * signature strings these factories actually use.
 */
function makeTyped() {
  return function typed(
    _name: string,
    signatures: Record<string, unknown>
  ): (...args: unknown[]) => unknown {
    function matchesType(value: unknown, type: string): boolean {
      type = type.trim();
      if (type === 'any') return true;
      if (type === 'string') return typeof value === 'string';
      if (type === 'Map') return value instanceof Map;
      if (type === 'Object') return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Map);
      if (type === 'Array') return Array.isArray(value);
      if (type === 'Matrix') return false;
      return false;
    }
    function matchesUnion(value: unknown, union: string): boolean {
      return union.split('|').some((t) => matchesType(value, t));
    }
    const dispatcher = function (...args: unknown[]): unknown {
      for (const sig of Object.keys(signatures)) {
        const impl = signatures[sig] as (...args: unknown[]) => unknown;
        if (sig === '') {
          if (args.length === 0) return impl();
          continue;
        }
        const parts = sig.split(',').map((p) => p.trim());
        if (parts.length !== args.length) continue;
        if (parts.every((p, i) => matchesUnion(args[i], p))) {
          return impl(...args);
        }
      }
      throw new TypeError(`No matching signature for arguments in ${_name}`);
    };
    return dispatcher;
  };
}

// A tiny parse stub: returns a node whose compile/evaluate honour a fixed table.
function makeParse() {
  const table: Record<string, number> = {
    '2+3': 5,
    'a*b': 0, // resolved via scope below
    'sqrt(4)': 2,
  };
  return function parse(expr: string) {
    return {
      compile() {
        return {
          evaluate(scope?: Map<string, unknown> | Record<string, unknown>): unknown {
            if (expr === 'a*b') {
              const a = scope instanceof Map ? scope.get('a') : scope?.a;
              const b = scope instanceof Map ? scope.get('b') : scope?.b;
              return (a as number) * (b as number);
            }
            if (expr in table) return table[expr];
            // numeric literal
            const n = Number(expr);
            return Number.isNaN(n) ? undefined : n;
          },
        };
      },
    };
  };
}

describe('function/compile factory', () => {
  const typed = makeTyped();
  const parse = makeParse();
  const compile = createCompile({ typed, parse });

  it('compiles a string expression', () => {
    const code = compile('2+3');
    expect(code.evaluate()).toBe(5);
  });

  it('compiles an array of expressions (deepMap)', () => {
    const codes = compile(['2+3', 'sqrt(4)']);
    expect(codes[0].evaluate()).toBe(5);
    expect(codes[1].evaluate()).toBe(2);
  });
});

describe('function/evaluate factory', () => {
  const typed = makeTyped();
  const parse = makeParse();
  const evaluate = createEvaluate({ typed, parse });

  it('evaluates a string with an empty scope', () => {
    expect(evaluate('2+3')).toBe(5);
  });

  it('evaluates a string with a provided object scope', () => {
    expect(evaluate('a*b', { a: 6, b: 7 })).toBe(42);
  });

  it('evaluates a string with a provided Map scope', () => {
    expect(evaluate('a*b', new Map([['a', 3], ['b', 4]]))).toBe(12);
  });

  it('evaluates an array of expressions (deepMap)', () => {
    expect(evaluate(['2+3', 'sqrt(4)'])).toEqual([5, 2]);
  });

  it('evaluates an array of expressions with a scope', () => {
    expect(evaluate(['2+3'], {})).toEqual([5]);
  });
});

describe('function/parser factory', () => {
  const typed = makeTyped();

  it('creates a new Parser instance via the no-arg signature', () => {
    let constructed = false;
    class FakeParser {
      constructor() {
        constructed = true;
      }
    }
    const parser = createParser({ typed, Parser: FakeParser });
    const p = parser();
    expect(constructed).toBe(true);
    expect(p).toBeInstanceOf(FakeParser);
  });
});

describe('function/help factory', () => {
  const typed = makeTyped();

  class FakeHelp {
    doc: unknown;
    constructor(doc: unknown) {
      this.doc = doc;
    }
  }

  it('returns a Help for a known function name (string search)', () => {
    const help = createHelp({
      typed,
      mathWithTransform: {},
      Help: FakeHelp,
    });
    const result = help('sin');
    expect(result).toBeInstanceOf(FakeHelp);
    expect((result as any).doc).toBeTruthy();
  });

  it('resolves a function reference back to its name', () => {
    const sinFn = () => 0;
    const help = createHelp({
      typed,
      mathWithTransform: { sin: sinFn },
      Help: FakeHelp,
    });
    const result = help(sinFn);
    expect(result).toBeInstanceOf(FakeHelp);
  });

  it('throws when no documentation is found for a string', () => {
    const help = createHelp({ typed, mathWithTransform: {}, Help: FakeHelp });
    expect(() => help('no_such_function_xyz')).toThrow(/No documentation found/);
  });

  it('throws when no documentation is found for an unknown function reference', () => {
    const help = createHelp({ typed, mathWithTransform: {}, Help: FakeHelp });
    const unknownFn = function unknownFn() {};
    expect(() => help(unknownFn)).toThrow(/No documentation found/);
  });
});
