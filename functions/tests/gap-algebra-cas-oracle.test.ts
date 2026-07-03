import { describe, it, expect } from 'vitest';

import { leafCount, rationalize } from '../src/factories/index.js';

/**
 * Coverage audit of the activated algebra/CAS layer the 2026-07-02 DGT sweep
 * flagged as having no *direct* test. Result of the audit:
 *
 *  - `simplify` / `derivative` / `polynomialRoot` — genuinely covered (real
 *    assertions in algebra.test.ts / cas.test.ts / forward-mode-ad.test.ts).
 *  - `leafCount` — was smoke-only (`typeof leafCount === 'function'`); pinned
 *    here with deterministic oracles.
 *  - `sylvester` / `lyap` — were smoke-only AND broken; fixed + pinned in
 *    `gap-sylvester-lyap-oracle.test.ts`.
 *  - `rationalize` — was smoke-only AND broken (every call threw). Root cause was
 *    in `simplify`: an `ObjectWrappingMap` scope reached `resolve`, whose typed
 *    `Map` test only accepts native Maps (core registers no duck-typing `Map`
 *    type), so the scope was classified as "any". Fixed by coercing the scope to
 *    a native Map in `_simplify`; pinned below.
 *
 * `leafCount(expr)` counts leaf nodes of the parse tree (symbols + constants;
 * operators and function-application nodes are not leaves, but a function's name
 * identifier IS a leaf — hence `sin(x)` = 2). Values are deterministic.
 */

const lc = leafCount as (expr: string) => number;

describe('leafCount — deterministic oracle', () => {
  it('single symbol / single constant = 1', () => {
    expect(lc('x')).toBe(1);
    expect(lc('3')).toBe(1);
  });

  it('a*d-b*c = 4 (the four symbols; operators are not leaves)', () => {
    expect(lc('a*d-b*c')).toBe(4);
  });

  it('x+2 = 2 (symbol + constant)', () => {
    expect(lc('x+2')).toBe(2);
  });

  it('sin(x) = 2 (the `sin` identifier and `x` are both leaves)', () => {
    expect(lc('sin(x)')).toBe(2);
  });

  it('[a,b;c,d][0,1] = 6 (4 matrix-entry symbols + 2 index constants)', () => {
    expect(lc('[a,b;c,d][0,1]')).toBe(6);
  });
});

const rat = rationalize as (expr: string, scope?: unknown) => { toString(): string };

describe('rationalize — canonical polynomial oracle', () => {
  // The rationalized form of a polynomial is its unique expanded form (an
  // implementation-independent value); only the print spacing is formatting.
  it('(x+1)^2 expands to x^2 + 2x + 1', () => {
    expect(rat('(x+1)^2').toString()).toBe('x ^ 2 + 2 * x + 1');
  });

  it('x+x+x collects to 3*x', () => {
    expect(rat('x+x+x').toString()).toBe('3 * x');
  });

  it('string input with a scope: rationalize("x+x+x+y", {y:1}) = 3*x + 1 (docstring)', () => {
    expect(rat('x+x+x+y', { y: 1 }).toString()).toBe('3 * x + 1');
  });
});
