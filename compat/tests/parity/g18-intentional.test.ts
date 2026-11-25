import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';
import { create, all } from 'mathjs';
import { INTENTIONAL } from './intentional.js';

/**
 * #1585 — compat keeps the more accurate values, and mathjs 15.3.0 is documented as the
 * one that is wrong. These are NOT fixed to match the oracle; they are pinned in the other
 * direction: each assertion holds the compat value, and each comment quotes the mathjs
 * 15.3.0 value that compat declines to copy. If a source change moves a compat value onto
 * the mathjs value, the assertion fails and the decision must be re-made.
 *
 * Values are compared as `typeOf` + `format(value, { precision: 14 })`, the shared
 * differential format of the parity harness. Decision: `docs/api/compat.md`,
 * heading "Intentional divergences".
 */

function show(
  lib: { typeOf(...args: unknown[]): string; format(v: unknown, o: { precision: number }): string },
  value: unknown
): string {
  return lib.typeOf(value) + ' ' + lib.format(value, { precision: 14 });
}

describe('g18: intentional divergences from the mathjs oracle (#1585)', () => {
  const L = createCompat(compatAll, {});
  const B = createCompat(compatAll, { number: 'BigNumber' });
  const oracle = create(all, {});
  const oracleBig = create(all, { number: 'BigNumber' });

  it('zeta(-3) stays 1/120 to full double precision (mathjs 0.0083333345772996)', () => {
    // Exact zeta(-3) = 1/120 = 0.008333333333333333. mathjs 15.3.0 returns
    // 0.0083333345772996 (wrong in the 8th digit); compat's Borwein evaluation is closer.
    expect(show(L as never, L.zeta(-3))).toBe('number 0.0083333333333335');
    // The divergence from the oracle still exists — the test fails if compat converges to it.
    // (The issue capture printed 0.0083333345772996; the 17th digit of mathjs's double is
    // formatting-round, so pin the 14-digit prefix, which is the wrong value either way.)
    expect(show(oracle as never, oracle.zeta(-3))).toMatch(/^number 0\.00833333457729/);
    expect(oracle.zeta(-3) as number).not.toBeCloseTo(1 / 120, 9);
  });

  it('zeta(complex(1, 2)) stays finite (mathjs NaN + NaNi)', () => {
    // mathjs 15.3.0 returns NaN + NaNi for complex arguments in the critical strip.
    // Compared numerically: the 15th digit of the format string is engine-round
    // (V8 prints …76239, JSC …76238), and the pinned value is the accuracy decision.
    const v = L.zeta(L.complex(1, 2)) as { re: number; im: number };
    expect(L.typeOf(v)).toBe('Complex');
    expect(v.re).toBeCloseTo(0.5981655697623851, 11);
    expect(v.im).toBeCloseTo(-0.35185474521784715, 11);
    expect(Number.isFinite(v.re) && Number.isFinite(v.im)).toBe(true);
    const theirs = oracle.zeta(oracle.complex(1, 2)) as { re: number; im: number };
    expect(Number.isNaN(theirs.re) && Number.isNaN(theirs.im)).toBe(true);
  });

  it('zeta(bignumber(4)) stays closer to pi^4/90 (mathjs 1.0823232498396)', () => {
    // pi^4/90 = 1.082323233711138... compat 1.0823232337111 (rel.err ~3e-14);
    // mathjs 15.3.0 returns 1.0823232498396 (rel.err ~1.5e-8).
    expect(show(L as never, L.zeta(L.bignumber(4)))).toBe('BigNumber 1.0823232337111');
    expect(show(oracle as never, oracle.zeta(oracle.bignumber(4)))).toBe(
      'BigNumber 1.0823232498396'
    );
  });

  it("[BigNumber cfg] symbolicEqual('x*y', 'y*x') stays true (mathjs false)", () => {
    // x*y and y*x are algebraically identical. mathjs 15.3.0 in BigNumber mode returns
    // false; compat returns true. (The issue states the exact-value comparison.)
    expect(B.evaluate('symbolicEqual("x*y", "y*x")')).toBe(true);
    expect(oracleBig.evaluate('symbolicEqual("x*y", "y*x")') as boolean).toBe(false);
  });

  it("[BigNumber cfg] range('4:10') includes 10, like number mode (mathjs drops it)", () => {
    // mathjs 15.3.0 in BigNumber mode returns [4, 5, 6, 7, 8, 9] — its BigNumber range
    // loses the inclusive end. compat keeps 10, matching mathjs's own number mode.
    const r = B.evaluate('range("4:10")') as { toArray(): unknown[] };
    expect(L.typeOf(r)).toBe('DenseMatrix');
    expect(r.toArray().map(String)).toEqual(['4', '5', '6', '7', '8', '9', '10']);
    const theirs = oracleBig.evaluate('range("4:10")') as { toArray(): unknown[] };
    expect(theirs.toArray().map(String)).toEqual(['4', '5', '6', '7', '8', '9']);
  });

  it('the decision is registered: intentional.ts holds #1585 and known-gaps.json does not', () => {
    expect(INTENTIONAL['1585']).toBeTruthy();
    expect(INTENTIONAL['1585'].length).toBeGreaterThanOrEqual(5);
    for (const entry of INTENTIONAL['1585']) expect(() => entry.assert()).not.toThrow();
    const gaps = JSON.parse(
      readFileSync(new URL('./known-gaps.json', import.meta.url), 'utf8')
    ) as Record<string, string[]>;
    expect(Object.keys(gaps)).not.toContain('1585');
  });

  it('the decision is documented in docs/api/compat.md', () => {
    const doc = readFileSync(new URL('../../../docs/api/compat.md', import.meta.url), 'utf8');
    expect(doc).toMatch(/^## Intentional divergences$/m);
    for (const name of [
      'zeta(-3)',
      'zeta(complex(1, 2))',
      'zeta(bignumber(4))',
      'symbolicEqual',
      'range("4:10")',
    ]) {
      expect(doc).toContain(name);
    }
    expect(doc).toContain('#1585');
  });
});
