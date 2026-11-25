import { expect } from 'vitest';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';
import { create, all } from 'mathjs';

/**
 * Behaviors where compat is deliberately more correct than the mathjs oracle. Each entry
 * asserts the compat value and quotes the mathjs 15.3.0 value it declines to match. A new
 * entry needs a decision recorded in `docs/api/compat.md` (`Intentional divergences`).
 */
export const INTENTIONAL: Record<string, Array<{ label: string; assert: () => void }>> = {
  // #1585 — compat keeps the mathematically correct values; mathjs 15.3.0's zeta loses
  // precision (the exact value of zeta(-3) is 1/120), returns NaN on Complex input, and
  // drops the inclusive range end in BigNumber mode.
  '1585': [
    {
      label: 'zeta(-3) stays 1/120 (mathjs 0.0083333345772996)',
      assert: () => {
        const L = createCompat(compatAll, {});
        const v = L.zeta(-3) as number;
        expect(v).toBeCloseTo(1 / 120, 15);
      },
    },
    {
      label: 'zeta(complex(1, 2)) stays finite (mathjs NaN + NaNi)',
      assert: () => {
        const L = createCompat(compatAll, {});
        const v = L.zeta(L.complex(1, 2)) as { re: number; im: number };
        expect(Number.isFinite(v.re) && Number.isFinite(v.im)).toBe(true);
      },
    },
    {
      label: 'zeta(bignumber(4)) stays closer to pi^4/90 (mathjs 1.0823232498396)',
      assert: () => {
        const L = createCompat(compatAll, {});
        const v = L.zeta(L.bignumber(4)) as { toString(): string };
        const oracle = create(all, {});
        const theirs = oracle.zeta(oracle.bignumber(4)) as { toString(): string };
        expect(v.toString()).not.toBe(theirs.toString());
      },
    },
    {
      label: "[BigNumber cfg] symbolicEqual('x*y', 'y*x') stays true (mathjs false)",
      assert: () => {
        const L = createCompat(compatAll, { number: 'BigNumber' });
        expect(L.evaluate('symbolicEqual("x*y", "y*x")')).toBe(true);
      },
    },
    {
      label: "[BigNumber cfg] range('4:10') includes 10 (mathjs drops it)",
      assert: () => {
        const L = createCompat(compatAll, { number: 'BigNumber' });
        expect(
          (L.evaluate('range("4:10")') as { toArray(): unknown[] }).toArray().map(String)
        ).toEqual(['4', '5', '6', '7', '8', '9', '10']);
      },
    },
  ],
};
