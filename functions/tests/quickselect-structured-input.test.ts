import { describe, it, expect } from 'vitest';
import { quickSelectInPlace, medianNumbers } from '../src/utils/median-numbers.js';
import { quickSelect, medianSelect, minSelect, maxSelect } from '../src/typed/statistics.js';
import { quantileSeq } from '../src/factories/index.js';
import {
  quantileOfSorted,
  type NumpyQuantileMethod,
} from '../src/statistics/quantile-numpy-methods.js';

// Quickselect must cost O(n log n) at worst, on any input (#1005). A fixed pivot from the first,
// middle and last value gave O(n^2) on a sorted array that was rotated: 19 s for 1e6 values at
// p = 0.9, where the sort took 1.5 s. The pivot is now pseudo-random, and a pass budget switches
// to a sort of the rest of the range.

const q = quantileSeq as (...a: unknown[]) => unknown;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

type Make = (n: number, rnd: () => number) => Float64Array;
const SHAPES: Record<string, Make> = {
  random: (n, r) => Float64Array.from({ length: n }, r),
  duplicates: (n, r) => Float64Array.from({ length: n }, () => Math.floor(r() * 5)),
  twoValues: (n, r) => Float64Array.from({ length: n }, () => (r() < 0.5 ? 0 : 1)),
  constant: (n) => new Float64Array(n).fill(2),
  ascending: (n) => Float64Array.from({ length: n }, (_, i) => i),
  descending: (n) => Float64Array.from({ length: n }, (_, i) => n - i),
  organPipe: (n) => Float64Array.from({ length: n }, (_, i) => (i < n / 2 ? i : n - i)),
  saw: (n) => Float64Array.from({ length: n }, (_, i) => i % 7),
  rotatedThird: (n) => Float64Array.from({ length: n }, (_, i) => (i + Math.floor(n / 3)) % n),
  rotatedHalf: (n) => Float64Array.from({ length: n }, (_, i) => (i + Math.floor(n / 2)) % n),
  negativeZero: (n, r) => Float64Array.from({ length: n }, () => (r() < 0.5 ? -0 : 0)),
};

/**
 * Select the k-th value of a copy of `input` and name the first postcondition that fails, or
 * return `null`: the result is the k-th smallest value, the array is partitioned around it, and
 * the array is a permutation of the input.
 */
function selectionFault(input: Float64Array, k: number, maxPasses?: number): string | null {
  const work = Float64Array.from(input);
  const sorted = Float64Array.from(input).sort();
  const got =
    maxPasses === undefined
      ? quickSelectInPlace(work, 0, work.length - 1, k)
      : quickSelectInPlace(work, 0, work.length - 1, k, maxPasses);
  // `===` treats -0 and 0 as one value, as the partition does.
  if (got !== sorted[k]) return `returned ${got}, the k-th value is ${sorted[k]}`;
  if (work[k] !== sorted[k]) return `a[k] is ${work[k]}, the k-th value is ${sorted[k]}`;
  for (let i = 0; i < k; i++) if (!(work[i] <= work[k])) return `a[${i}] is above a[k]`;
  for (let i = k + 1; i < work.length; i++) {
    if (!(work[i] >= work[k])) return `a[${i}] is below a[k]`;
  }
  // A permutation of the input: nothing is lost or invented.
  work.sort();
  for (let i = 0; i < work.length; i++) {
    if (work[i] !== sorted[i]) return 'the array is not a permutation of the input';
  }
  return null;
}

/**
 * `a` with every element read and write counted. The call that passes `cap` operations throws,
 * so a quadratic run fails at once. The count is a deterministic proxy for the work: a clock
 * would depend on the machine.
 */
function metered(a: Float64Array, cap: number): Float64Array {
  let ops = 0;
  const isIndex = (prop: string | symbol): boolean =>
    typeof prop === 'string' && prop.charCodeAt(0) >= 48 && prop.charCodeAt(0) <= 57;
  return new Proxy(a, {
    get(target, prop) {
      if (isIndex(prop)) {
        if (++ops > cap) throw new Error(`work budget of ${cap} element operations exceeded`);
        return (target as unknown as Record<string | symbol, number>)[prop];
      }
      const value = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) {
      if (isIndex(prop) && ++ops > cap) {
        throw new Error(`work budget of ${cap} element operations exceeded`);
      }
      (target as unknown as Record<string | symbol, unknown>)[prop] = value;
      return true;
    },
  });
}

describe('quickSelectInPlace on structured input (#1005)', () => {
  it('selects the k-th value and partitions the array, for every shape, size and budget', () => {
    const rnd = lcg(20261120);
    const faults: string[] = [];
    let cases = 0;
    for (const [name, make] of Object.entries(SHAPES)) {
      for (const n of [1, 2, 3, 4, 5, 10, 33, 64, 65, 200, 1000]) {
        const input = make(n, rnd);
        const ks = new Set([0, n - 1, n >> 1, Math.floor(0.9 * (n - 1)), Math.floor(rnd() * n)]);
        for (const k of ks) {
          // The default budget, then budgets that stop the passes early: 0 sorts at once.
          // A range of 64 values or fewer has no budget, so 65, 200 and 1000 reach the sort.
          for (const budget of [undefined, 0, 1, 2, 5]) {
            const fault = selectionFault(input, k, budget);
            if (fault !== null) faults.push(`${name} n=${n} k=${k} budget=${budget}: ${fault}`);
            cases++;
          }
        }
      }
    }
    expect(faults).toEqual([]);
    expect(cases).toBeGreaterThan(1500);
  });

  it('does a linear amount of work on a rotated, patterned or sorted array', () => {
    // Measured on 2e4 values: 4.5 to 6.7 element operations per value for the pseudo-random
    // pivot. The fixed first, middle and last pivot took 110 per value on a sorted array
    // rotated by a third, and more than 250 on one rotated by a half (quadratic growth). The
    // test uses 5e3 values: the fixed pivot still passes the cap there, and the counting proxy
    // stays below a second on a loaded machine.
    const n = 5_000;
    for (const shape of ['random', 'rotatedThird', 'rotatedHalf', 'organPipe', 'ascending']) {
      const input = SHAPES[shape](n, lcg(1));
      const sorted = Float64Array.from(input).sort();
      for (const k of [0, Math.floor(0.1 * n), n >> 1, Math.floor(0.9 * n), n - 1]) {
        const got = quickSelectInPlace(metered(Float64Array.from(input), 15 * n), 0, n - 1, k);
        expect(got === sorted[k], `${shape} k=${k}`).toBe(true);
      }
    }
  });

  it('gives the sorted-array quantile of rotated input, for quantileSeq and median', () => {
    const n = 4001;
    const methods: NumpyQuantileMethod[] = ['linear', 'lower', 'hazen', 'inverted_cdf'];
    for (const shape of ['rotatedThird', 'rotatedHalf']) {
      const data = Array.from(SHAPES[shape](n, lcg(2)));
      const sorted = data.slice().sort((a, b) => a - b);
      for (const m of methods) {
        for (const p of [0, 0.1, 0.5, 0.75, 0.9, 0.99, 1]) {
          expect(q(data, p, m), `${shape} ${m} p=${p}`).toBe(quantileOfSorted(sorted, p, m));
        }
      }
      expect(medianNumbers(data)).toBe(quantileOfSorted(sorted, 0.5, 'linear'));
    }
  });

  it('gives the sorted-array result of rotated input for the typed selection functions', () => {
    // quickSelect, medianSelect, minSelect and maxSelect had a copy of the fixed-pivot
    // selection: quickSelect of 1e5 values rotated by a half took 4.3 s at k = 0.9 n. They now
    // call quickSelectInPlace, so the work bound above is their bound.
    for (const n of [4000, 4001]) {
      for (const shape of ['rotatedThird', 'rotatedHalf', 'organPipe', 'duplicates']) {
        const data = Array.from(SHAPES[shape](n, lcg(3)));
        const before = data.slice();
        const sorted = data.slice().sort((a, b) => a - b);
        for (const k of [0, 1, n >> 1, Math.floor(0.9 * n), n - 1]) {
          expect(quickSelect(data, k), `${shape} n=${n} k=${k}`).toBe(sorted[k]);
        }
        const mid = n >> 1;
        const median = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        expect(medianSelect(data), `${shape} n=${n}`).toBe(median);
        expect(minSelect(data, 37)).toEqual(sorted.slice(0, 37));
        expect(maxSelect(data, 37)).toEqual(sorted.slice(-37).reverse());
        expect(data).toEqual(before);
      }
    }
  });
});
