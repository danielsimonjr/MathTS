import { describe, it, expect } from 'vitest';
import { createParser } from '../src/function/parser.js';

/**
 * `createParser` is the one surviving mathjs-style factory in
 * `expression/src/function/` — it is wired into the package index and consumed
 * by the live `Parser` class. Its former siblings `createCompile`,
 * `createEvaluate`, and `createHelp` were superseded, mathjs-lineage duplicates
 * of the active `compiler/compile.ts`, `evaluator/evaluate.ts`, and `Help.ts`
 * (which use MathTS-native positional signatures, not dependency injection, and
 * are what `functions`/`workbook` actually import). They were removed
 * 2026-07-05 rather than wired — wiring would have collided with the
 * `createEvaluate` already exported from `evaluator/index.ts`.
 *
 * The factory calls `typed(name, { '<signature>': fn })` and expects back a
 * dispatcher; the minimal `typed` mock below dispatches on the JS types of the
 * arguments, mirroring the signature strings the factory uses.
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
      if (type === 'Object')
        return (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          !(value instanceof Map)
        );
      if (type === 'Array') return Array.isArray(value);
      if (type === 'Matrix') return false;
      return false;
    }
    function matchesUnion(value: unknown, union: string): boolean {
      return union.split('|').some((t) => matchesType(value, t));
    }
    return function dispatcher(...args: unknown[]): unknown {
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
  };
}

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
