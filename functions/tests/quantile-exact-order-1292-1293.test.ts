import { describe, it, expect } from 'vitest';
import { quantileSeq, median, bignumber, partitionSelect } from '../src/factories/index.js';

const q = quantileSeq as (...a: unknown[]) => unknown;
const med = median as (...a: unknown[]) => unknown;
const B = bignumber as (x: unknown) => unknown;
const ps = partitionSelect as (...a: unknown[]) => unknown;
const str = (v: unknown): string => String(v);

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  const out: T[][] = [];
  xs.forEach((x, i) => {
    const rest = [...xs.slice(0, i), ...xs.slice(i + 1)];
    for (const p of permutations(rest)) out.push([x, ...p]);
  });
  return out;
}

// Values that differ by less than the config relTol (1e-12): `compare` reads them as equal.
const CLOSE = ['1', '1.0000000000001', '1.0000000000002', '2'];

describe('#1292 order statistics of BigNumber data within relTol do not depend on the input order', () => {
  const sortedData = (): unknown[] => CLOSE.map(B);

  it('quantileSeq(p = 0.5) gives the sorted result for every permutation', () => {
    const expected = str(q(sortedData(), B('0.5'), true));
    expect(expected).toBe('1.00000000000015');
    for (const perm of permutations(CLOSE)) {
      expect(str(q(perm.map(B), B('0.5')))).toBe(expected);
    }
  });

  it("quantileSeq(p = 0.34, 'lower') gives the sorted result for every permutation", () => {
    const expected = str(q(sortedData(), 0.34, true, 'lower'));
    expect(expected).toBe('1.0000000000001');
    for (const perm of permutations(CLOSE)) {
      expect(str(q(perm.map(B), 0.34, 'lower'))).toBe(expected);
    }
  });

  it('median gives the exact mean of the two middle values for every permutation', () => {
    for (const perm of permutations(CLOSE)) {
      expect(str(med(perm.map(B)))).toBe('1.00000000000015');
    }
  });

  it('median of an odd count gives the exact middle value for every permutation', () => {
    const three = ['1.0000000000002', '1', '1.0000000000001'];
    for (const perm of permutations(three)) {
      expect(str(med(perm.map(B)))).toBe('1.0000000000001');
    }
  });
});

/** Count the pivot draws of partitionSelect: one draw per partition pass. */
function countPasses(run: () => unknown): number {
  const original = Math.random;
  let draws = 0;
  Math.random = () => {
    draws++;
    return original();
  };
  try {
    run();
  } finally {
    Math.random = original;
  }
  return draws;
}

describe('#1293 partitionSelect is not quadratic on equal values', () => {
  const N = 2000;

  it('numbers: n equal values take one pass', () => {
    const arr = new Array(N).fill(5);
    let got: unknown;
    const passes = countPasses(() => (got = ps(arr, N / 2)));
    expect(got).toBe(5);
    expect(passes).toBeLessThanOrEqual(2);
  });

  it('numbers: two distinct values take few passes', () => {
    const arr = Array.from({ length: N }, (_, i) => (i % 2 === 0 ? 1 : 2));
    let got: unknown;
    const passes = countPasses(() => (got = ps(arr, N / 4)));
    expect(got).toBe(1);
    expect(passes).toBeLessThanOrEqual(40);
  });

  it('comparator: n equal values cost at most 20 n compares', () => {
    let calls = 0;
    const cmp = (a: number, b: number): number => {
      calls++;
      return a - b;
    };
    expect(ps(new Array(N).fill(5), N / 2, cmp)).toBe(5);
    expect(calls).toBeLessThanOrEqual(20 * N);
  });

  it('comparator: two distinct values cost at most 20 n compares', () => {
    let calls = 0;
    const cmp = (a: number, b: number): number => {
      calls++;
      return a - b;
    };
    const arr = Array.from({ length: N }, (_, i) => (i % 2 === 0 ? 1 : 2));
    expect(ps(arr, (3 * N) / 4, cmp)).toBe(2);
    expect(calls).toBeLessThanOrEqual(20 * N);
  });

  it('BigNumber: quantileSeq of 2000 equal values is cheap and exact', () => {
    const data = Array.from({ length: N }, () => B(5));
    const passes = countPasses(() => expect(str(q(data, 0.9))).toBe('5'));
    expect(passes).toBeLessThanOrEqual(4);
  });

  it('keeps the partition contract: values before k are <= arr[k], after are >=', () => {
    const arr = Array.from({ length: 500 }, (_, i) => (i * 37) % 11);
    const k = 200;
    const v = ps(arr, k) as number;
    for (let i = 0; i < k; i++) expect(arr[i]).toBeLessThanOrEqual(v);
    for (let i = k + 1; i < arr.length; i++) expect(arr[i]).toBeGreaterThanOrEqual(v);
    expect(arr[k]).toBe(v);
  });
});
