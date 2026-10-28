/**
 * Sprint 2R clone-merge (filterTransform / forEachTransform arg walk) —
 * independent oracles for the three callback compile paths, scope, errors,
 * and compiling the collection argument once.
 */
import { describe, it, expect } from 'vitest';
import { evaluate } from '../../functions/src/factories/evaluate.js';
import { factoryScope } from '../../functions/src/factories/scope.js';
import { createFilterTransform } from '../src/transform/filter.transform.js';
import { createForEachTransform } from '../src/transform/forEach.transform.js';

const U = { unsafe: true };

const val = (r: unknown): unknown => {
  const m = r as { toArray?: () => unknown };
  if (m && typeof m.toArray === 'function') return m.toArray();
  return r;
};

describe('filter transform arg oracle', () => {
  it('inline relational predicate keeps elements above threshold', () => {
    expect(val(evaluate('filter([1, 2, 3, 4], x > 2)', undefined, U))).toEqual([3, 4]);
  });

  it('empty result when no elements pass', () => {
    expect(val(evaluate('filter([1, 2, 3, 4], x > 10)', undefined, U))).toEqual([]);
  });

  it('empty collection yields empty array', () => {
    expect(val(evaluate('filter([], x > 0)', undefined, U))).toEqual([]);
  });

  it('filter transform keeps rawArgs true', () => {
    const filterTransform = createFilterTransform(
      factoryScope as Parameters<typeof createFilterTransform>[0]
    );
    expect(filterTransform.rawArgs).toBe(true);
  });

  it('scope symbol callback matches the inline predicate', () => {
    const scope = new Map<string, unknown>([['gt2', (x: number) => x > 2]]);
    expect(val(evaluate('filter([1, 2, 3, 4], gt2)', scope))).toEqual([3, 4]);
  });

  it('function-assignment callback matches the inline predicate', () => {
    expect(val(evaluate('filter([1, 2, 3, 4], f(x) = x > 2)', undefined, U))).toEqual([3, 4]);
  });

  it('compiles the collection argument once', () => {
    class CountingMap extends Map<string, unknown> {
      xsReads = 0;
      override get(key: string): unknown {
        if (key === 'xs') this.xsReads += 1;
        return super.get(key);
      }
    }
    const scope = new CountingMap([
      ['xs', [1, 2, 3, 4]],
      ['gt2', (x: number) => x > 2],
    ]);
    expect(val(evaluate('filter(xs, gt2)', scope))).toEqual([3, 4]);
    expect(scope.xsReads).toBe(1);
  });

  it('inline callback with no free variable throws the compileInlineExpression error', () => {
    expect(() => evaluate('filter([1, 2], 1)', undefined, U)).toThrow(
      /No undefined variable found in inline expression/
    );
  });
});

describe('forEach transform arg oracle', () => {
  it('function-assignment callback runs on each element', () => {
    const bag: number[] = [];
    const scope = new Map<string, unknown>([['bag', bag]]);
    evaluate('forEach([2, 4], f(x) = bag.push(x))', scope, U);
    expect(bag).toEqual([2, 4]);
  });

  it('inline FunctionNode callback runs on each element', () => {
    const bag: number[] = [];
    const scope = new Map<string, unknown>([['bag', bag]]);
    evaluate('forEach([2, 4], bag.push(x))', scope, U);
    expect(bag).toEqual([2, 4]);
  });

  it('scope symbol callback receives one-based index arrays', () => {
    const seen: unknown[] = [];
    const scope = new Map<string, unknown>([['record', (_x: number, i: number) => seen.push(i)]]);
    evaluate('forEach([5, 6], record)', scope);
    expect(seen).toEqual([[1], [2]]);
  });

  it('filter callback sees one-based index arrays like forEach', () => {
    const seen: unknown[] = [];
    const scope = new Map<string, unknown>([['record', (_x: number, i: number) => seen.push(i)]]);
    evaluate('filter([5, 6], record)', scope, U);
    expect(seen).toEqual([[1], [2]]);
  });

  it('forEach transform keeps rawArgs true', () => {
    const forEachTransform = createForEachTransform(
      factoryScope as Parameters<typeof createForEachTransform>[0]
    );
    expect(forEachTransform.rawArgs).toBe(true);
  });
});
