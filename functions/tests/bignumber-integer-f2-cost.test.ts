/**
 * The BigNumber combinations, permutations and multinomial are exact while the exact bigint loop
 * is the cheaper one. A loop of k products of numbers of b bits ends with k * b bits, and each step
 * costs time in that size, so an exact loop costs O(k^2): C(1e6, 6e4) took 20 s, C(1e6, 1e5)
 * minutes. The loop limit of the file (10 million steps) bounds the steps, not the size. Where the
 * cost model of `probability/rounded-loop.ts` (limb operations of each loop) says that the exact
 * loop is the dearer one, the loops run at a working precision, which costs O(k), and the rounding
 * proof of that loop keeps the value equal to the exact value rounded one time. The working
 * precision depends on the count of steps only, not on the digits of the operand, so a short loop
 * on an operand of many digits also takes the working loop (measured: 0.04 ms against 0.15 ms
 * for two steps on a 2000-digit operand).
 *
 * The test reads which path ran from the calls of `BigNumber.config` (the working precision is set
 * and restored there), not from a clock.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { combinations, permutations, multinomial, combinationsWithRep } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const bn = (v: number | string) => BigNumber.parse(String(v));

/** The largest precision that BigNumber.config received during fn. */
function maxConfiguredPrecision(fn: () => unknown): { result: unknown; raised: number } {
  const original = BigNumber.config;
  let raised = 0;
  (BigNumber as unknown as { config: unknown }).config = function (
    this: unknown,
    options: { precision?: number }
  ) {
    if (options && typeof options.precision === 'number') {
      raised = Math.max(raised, options.precision);
    }
    return original.call(this as typeof BigNumber, options);
  };
  try {
    return { result: fn(), raised };
  } finally {
    (BigNumber as unknown as { config: unknown }).config = original;
  }
}

const rounded = (v: bigint) => BigNumber.fromBigInt(v).toSignificantDigits(64).toString();
const exactBinomial = (n: bigint, k: bigint) => {
  let c = 1n;
  for (let i = 1n; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
};

describe('exact bigint loops are bounded in size', () => {
  it('a loop of two steps on a 2000-digit operand runs at a working precision and is exact rounded', () => {
    const n = 10n ** 2000n + 7n;
    const { result, raised } = maxConfiguredPrecision(() =>
      (combinations as Fn)(bn(n.toString()), bn(2))
    );
    // The working precision does not grow with the digits of the operand.
    expect(raised).toBeGreaterThan(64);
    expect(raised).toBeLessThan(100);
    expect(String(result)).toBe(rounded(exactBinomial(n, 2n)));
  });

  it('a loop of 32 steps on a 20-digit operand stays exact (no working precision)', () => {
    const n = 10n ** 20n + 7n;
    const { result, raised } = maxConfiguredPrecision(() =>
      (combinations as Fn)(bn(n.toString()), bn(32))
    );
    expect(raised).toBe(0);
    expect(String(result)).toBe(rounded(exactBinomial(n, 32n)));
  });

  it('a short loop is exact and sets no working precision', () => {
    const { result, raised } = maxConfiguredPrecision(() => (combinations as Fn)(bn(200), bn(100)));
    expect(String(result)).toBe(rounded(exactBinomial(200n, 100n)));
    expect(raised).toBe(0);
  });

  it('combinations(1e6, 6000) runs at a working precision and equals the exact value rounded', () => {
    const { result, raised } = maxConfiguredPrecision(() =>
      (combinations as Fn)(bn(1000000), bn(6000))
    );
    expect(raised).toBeGreaterThan(64);
    expect(String(result)).toBe(rounded(exactBinomial(1000000n, 6000n)));
  });

  it('combinationsWithRep(1e6, 6000) runs at a working precision', () => {
    const { result, raised } = maxConfiguredPrecision(() =>
      (combinationsWithRep as Fn)(bn(1000000), bn(6000))
    );
    expect(raised).toBeGreaterThan(64);
    expect(String(result)).toBe(rounded(exactBinomial(1000000n + 6000n - 1n, 6000n)));
  });

  it('permutations(1e6, 6000) runs at a working precision and equals the exact value rounded', () => {
    const { result, raised } = maxConfiguredPrecision(() =>
      (permutations as Fn)(bn(1000000), bn(6000))
    );
    expect(raised).toBeGreaterThan(64);
    let p = 1n;
    for (let i = 1000000n - 6000n + 1n; i <= 1000000n; i++) p *= i;
    expect(String(result)).toBe(rounded(p));
  });

  it('multinomial of two large BigNumbers runs at a working precision', () => {
    const { result, raised } = maxConfiguredPrecision(() =>
      (multinomial as Fn)([bn(6000), bn(6000)])
    );
    expect(raised).toBeGreaterThan(64);
    expect(String(result)).toBe(rounded(exactBinomial(12000n, 6000n)));
  });
});
