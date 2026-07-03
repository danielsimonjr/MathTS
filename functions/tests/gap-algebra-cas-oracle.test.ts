import { describe, it, expect } from 'vitest';

import { leafCount } from '../src/factories/index.js';

/**
 * Coverage audit of the activated algebra/CAS layer the 2026-07-02 DGT sweep
 * flagged as having no *direct* test. Result of the audit:
 *
 *  - `simplify` / `derivative` / `polynomialRoot` — genuinely covered (real
 *    assertions in algebra.test.ts / cas.test.ts / forward-mode-ad.test.ts).
 *  - `leafCount` — was smoke-only (`typeof leafCount === 'function'`); pinned
 *    here with deterministic oracles.
 *  - `sylvester` / `lyap` / `rationalize` — smoke-only AND **broken** (surfaced
 *    by this audit; tracked as HIGH items in TODO.md, not pinned here):
 *      · `sylvester(A,B,C)` throws in `subset(G, index(k,k))` → `MathJSDenseMatrix.get`
 *        (out-of-range row); `lyap` fails through it. Now *reached* because the
 *        factory `schur` it depends on was fixed earlier this session.
 *      · `rationalize(expr)` has no `string` signature (its own docstring shows
 *        `rationalize('sin(x)+y')`) and the 2-arg form throws inside `resolve`.
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
