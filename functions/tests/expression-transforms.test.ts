import { describe, it, expect } from 'vitest';
import { evaluate } from '../src/factories/evaluate.js';

/**
 * Expression-language transforms (the formerly-dormant expression/src/transform
 * pocket, wired 2026-07-05). In mathjs, `map`/`filter`/`max`/`or`/… behave
 * differently INSIDE the expression language than as programmatic API: indices
 * and dimensions are 1-based, and logical operators short-circuit lazily
 * (`rawArgs`). Before wiring, the language was internally inconsistent —
 * `A[1]` was 1-based but `row(A, 1)` was 0-based, `max(M, dim)` rejected dim
 * arguments outright, and `true or undefinedVar` threw instead of
 * short-circuiting.
 *
 * Inline `f(x) = …` callbacks require `{ unsafe: true }` (the documented
 * trusted-input opt-out — the sandbox rejects FunctionAssignmentNode by
 * default); scope-provided callbacks work in default-safe mode.
 */
const U = { unsafe: true };

/** Array literals become Matrices inside expressions (mathjs semantics) — compare values. */
const val = (r: unknown): unknown => {
  const m = r as { toArray?: () => unknown; valueOf?: () => unknown };
  if (m && typeof m.toArray === 'function') return m.toArray();
  if (m && typeof m.valueOf === 'function' && m.valueOf() !== r) return m.valueOf();
  return r;
};

describe('expression transforms — 1-based callback indices', () => {
  it('map with (value, index) callback gets ONE-based index ARRAYS (mathjs-exact)', () => {
    // The callback's index argument is a one-based index ARRAY (mathjs contract;
    // verified against mathjs 15: identical output). `x + i` broadcasts, so each
    // element becomes a 1-element array: [[11],[22],[33]] = [10+[1], 20+[2], 30+[3]].
    expect(val(evaluate('map([10, 20, 30], f(x, i) = x + i)', undefined, U))).toEqual([
      [11],
      [22],
      [33],
    ]);
    // scalar use of the 1-based index
    expect(val(evaluate('map([10, 20, 30], f(x, i) = x + i[1])', undefined, U))).toEqual([
      11, 22, 33,
    ]);
  });

  it('forEach passes 1-based indices too', () => {
    const seen: unknown[] = [];
    const scope = new Map<string, unknown>([['record', (x: number, i: number) => seen.push(i)]]);
    evaluate('forEach([5, 6], record)', scope);
    expect(seen).toEqual([[1], [2]]);
  });

  it('filter works with a scope-provided callback in default-safe mode', () => {
    const scope = new Map<string, unknown>([['big', (x: number) => x > 2]]);
    expect(val(evaluate('filter([1, 2, 3, 4], big)', scope))).toEqual([3, 4]);
  });
});

describe('expression transforms — 1-based dimensions/indices on reductions', () => {
  it('row(M, 1) returns the FIRST row (was 0-based: returned the second)', () => {
    expect(evaluate('row([[1, 2], [3, 4]], 1)')).toEqual([[1, 2]]);
  });

  it('column(M, 1) returns the FIRST column', () => {
    expect(evaluate('column([[1, 2], [3, 4]], 1)')).toEqual([[1], [3]]);
  });

  it('max/min accept a 1-based dim argument (previously rejected)', () => {
    expect(evaluate('max([[1, 2], [3, 4]], 1)')).toEqual([3, 4]);
    expect(evaluate('min([[1, 2], [3, 4]], 2)')).toEqual([1, 3]);
  });

  it('sum/mean accept a 1-based dim argument', () => {
    expect(evaluate('sum([[1, 2], [3, 4]], 1)')).toEqual([4, 6]);
    expect(evaluate('mean([[1, 2], [3, 4]], 2)')).toEqual([1.5, 3.5]);
  });
});

describe('expression transforms — lazy logical operators (rawArgs)', () => {
  it('true or <undefined symbol> short-circuits instead of throwing', () => {
    expect(evaluate('true or undefinedVariable')).toBe(true);
  });

  it('false and <undefined symbol> short-circuits', () => {
    expect(evaluate('false and undefinedVariable')).toBe(false);
  });

  it('the non-short-circuit side still evaluates', () => {
    expect(evaluate('false or true')).toBe(true);
    expect(() => evaluate('false or undefinedVariable')).toThrow();
  });
});

describe('expression transforms — 1-based subsetting and inclusive ranges (the core language fix)', () => {
  // The parser is DOCUMENTED one-based ("implicit start of range = 1
  // (one-based)", embeddedDocs subset: "Indexes are one-based"), but without
  // index.transform the compiled `math.index(...)` was the raw zero-based
  // function: A[1] returned the SECOND element and 1:3 excluded its end.
  it('A[1] is the FIRST element (was zero-based: returned the second)', () => {
    expect(evaluate('A[1]', new Map([['A', [10, 20]]]))).toBe(10);
  });

  it('A[end] is the LAST element', () => {
    expect(evaluate('A[end]', new Map([['A', [10, 20, 30]]]))).toBe(30);
  });

  it('ranges include their end: 1:3 = [1, 2, 3] (mathjs semantics)', () => {
    const r = evaluate('1:3') as { toArray?: () => number[] } | number[];
    const arr = Array.isArray(r) ? r : r.toArray!();
    expect(arr).toEqual([1, 2, 3]);
  });

  it('diff/concat/quantileSeq unchanged', () => {
    expect(evaluate('diff([1, 4, 9, 16])')).toEqual([3, 5, 7]);
    expect(evaluate('concat([1, 2], [3, 4])')).toEqual([1, 2, 3, 4]);
    expect(evaluate('quantileSeq([1, 2, 3, 4, 5], 0.5)')).toBe(3);
  });
});
