/**
 * BigNumber operations across the factory layer. These paths were silently broken — the
 * mathjs-lineage code assumed a decimal.js BigNumber API (`plus`/`minus`/`lte`/`eq`/`cmp`) that
 * MathTS core's BigNumber does not implement, so comparison/sort/median/corr/factorial/gamma/
 * quantile/isPrime either crashed or mis-ordered on BigNumber inputs. The 3400+ existing tests
 * stayed green because none of them exercised these paths; this file closes that gap.
 */
import { describe, it, expect } from 'vitest';
import {
  bignumber,
  sort,
  median,
  min,
  max,
  corr,
  cumsum,
  factorial,
  gamma,
  quantileSeq,
  isPrime,
  smaller,
  largerEq,
} from '../src/index.js';

const bn = (v: string | number): unknown => bignumber(v as never);
const S = (x: unknown): string => String(x);
const arr = (...vs: number[]): unknown[] => vs.map((v) => bn(v));

describe('BigNumber comparison / ordering', () => {
  it('sort orders BigNumbers ascending', () => {
    expect((sort(arr(3, 1, 2)) as unknown[]).map(S)).toEqual(['1', '2', '3']);
  });

  it('median / min / max on BigNumbers', () => {
    expect(S(median(arr(3, 1, 2)))).toBe('2');
    expect(S(min(arr(3, 1, 2)))).toBe('1');
    expect(S(max(arr(3, 1, 2)))).toBe('3');
  });

  it('relational operators with a number literal argument', () => {
    // Regresses the core coercion bug: bignumber(8).lessThanOrEqual(3) had returned true.
    expect(smaller(bn(2), bn(8))).toBe(true);
    expect(smaller(bn(8), bn(2))).toBe(false);
    expect(largerEq(bn(8), bn(8))).toBe(true);
  });
});

describe('BigNumber statistics', () => {
  it('cumsum', () => {
    expect((cumsum(arr(1, 2, 3, 4)) as unknown[]).map(S)).toEqual(['1', '3', '6', '10']);
  });

  it('corr stays within [-1, 1] and gives the right sign', () => {
    expect(S(corr(arr(1, 2, 3, 4, 5), arr(4, 5, 6, 7, 8)))).toBe('1');
    expect(S(corr(arr(1, 2, 3), arr(3, 2, 1)))).toBe('-1');
  });

  it('quantileSeq with a BigNumber array and probability', () => {
    const data = arr(3, 1, 2, 5, 4);
    expect(S(quantileSeq(data as never, bn(0.5) as never))).toBe('3');
    expect(S(quantileSeq(data as never, bn(0.25) as never))).toBe('2');
  });
});

describe('BigNumber probability / number theory', () => {
  it('factorial and gamma (idempotent bignumber(bignumber(x)) too)', () => {
    expect(S(bignumber(bignumber(3 as never) as never))).toBe('3'); // non-idempotence gave Infinity
    expect(S(factorial(bn(5) as never))).toBe('120');
    expect(S(factorial(bn(10) as never))).toBe('3628800');
    expect(S(gamma(bn(5) as never))).toBe('24'); // Γ(5) = 4!
  });

  it('isPrime across the small trial-division and large Miller-Rabin paths', () => {
    expect(isPrime(bn(7) as never)).toBe(true);
    expect(isPrime(bn(8) as never)).toBe(false);
    expect(isPrime(bn(2147483647) as never)).toBe(true); // 2^31 - 1
    expect(isPrime(bn(4294967311) as never)).toBe(true); // first prime > 2^32 (Miller-Rabin)
    expect(isPrime(bn(4294967296) as never)).toBe(false); // 2^32
    expect(isPrime(bn(1000000000039) as never)).toBe(true);
    expect(isPrime(bn(1000000000000) as never)).toBe(false);
  });
});
