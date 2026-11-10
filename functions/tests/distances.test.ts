import { describe, it, expect } from 'vitest';
import {
  wassersteinDistance,
  energyDistance,
  mutualInformation,
  ecdf,
} from '../src/stats/distances.js';

describe('wassersteinDistance', () => {
  it('shifted samples: 1-D W1 is 5', () => {
    expect(wassersteinDistance([0, 1, 3], [5, 6, 8])).toBeCloseTo(5, 12);
  });
  it('identical samples have distance 0', () => {
    expect(wassersteinDistance([0, 1], [0, 1])).toBeCloseTo(0, 12);
  });
  it('honors weights', () => {
    expect(
      wassersteinDistance([0, 10], [0, 10], { uWeights: [1, 1], vWeights: [3, 1] })
    ).toBeCloseTo(2.5, 12);
  });
  it('rejects empty samples', () => {
    expect(() => wassersteinDistance([], [1])).toThrow(RangeError);
  });
});

describe('energyDistance', () => {
  it('equals sqrt(22/3) for the reference samples', () => {
    expect(energyDistance([0, 1, 3], [5, 6, 8])).toBeCloseTo(Math.sqrt(22 / 3), 9);
  });
});

describe('mutualInformation', () => {
  it('perfectly dependent labels give ln 2', () => {
    expect(mutualInformation([0, 0, 1, 1], [0, 0, 1, 1])).toBeCloseTo(0.6931471805599453, 12);
  });
  it('independent labels give 0', () => {
    expect(mutualInformation([0, 0, 1, 1], [0, 1, 0, 1])).toBeCloseTo(0, 12);
  });
  it('rejects length mismatch', () => {
    expect(() => mutualInformation([0], [0, 1])).toThrow(RangeError);
  });
});

describe('ecdf', () => {
  it('step points and evaluate()', () => {
    const f = ecdf([3, 1, 2, 2]);
    expect(f.x).toEqual([1, 2, 3]);
    expect(f.y).toEqual([0.25, 0.75, 1]);
    expect(f.evaluate(0)).toBe(0);
    expect(f.evaluate(2)).toBe(0.75);
    expect(f.evaluate(10)).toBe(1);
  });
  it('rejects empty input', () => {
    expect(() => ecdf([])).toThrow(RangeError);
  });
});

describe('wassersteinDistance sweep (Copilot review)', () => {
  it('matches the closed form on shifted and weighted samples', () => {
    expect(wassersteinDistance([0, 1, 3], [5, 6, 8])).toBeCloseTo(5, 12);
    expect(wassersteinDistance([0, 1, 1, 2], [0, 1, 2])).toBeCloseTo(1 / 6, 12); // |¼−⅓| + |¾−⅔|
    expect(wassersteinDistance([0, 1], [0, 1], { uWeights: [1, 3], vWeights: [3, 1] })).toBeCloseTo(
      0.5,
      12
    );
  });
  it('reads each sample point a fixed number of times: 50,000 points', () => {
    // The check counts element reads, not time, so machine load cannot change the result. The
    // code makes 2 passes over each sample: one for the weights and one for the sorted copy. A
    // scan per merged point reads the input O(n²) times.
    const n = 50000;
    const reads = { n: 0 };
    const counted = (values: number[]): number[] =>
      new Proxy(values, {
        get(target, key, receiver) {
          if (typeof key === 'string' && /^\d+$/.test(key)) reads.n++;
          return Reflect.get(target, key, receiver);
        },
      });
    const a = counted(Array.from({ length: n }, (_, i) => Math.sin(i)));
    const b = counted(Array.from({ length: n }, (_, i) => Math.cos(i)));
    const d = wassersteinDistance(a, b);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(reads.n).toBeLessThanOrEqual(4 * n);
  });
  it('does not go quadratic in the sweep over the sorted copies', () => {
    // The read count above sees only the inputs. The sweep works on sorted copies, so this check
    // is a ratio of two clock reads, not an absolute budget. The n and 4n samples alternate in
    // one process, so machine load slows both lanes together. Each lane keeps its fastest of 7
    // samples. From n to 4n, O(n log n) grows the time about 4.5 times. O(n²) grows the time 16
    // times.
    const n = 8192;
    const points = (len: number, f: (i: number) => number): number[] =>
      Array.from({ length: len }, (_, i) => f(i));
    const small: [number[], number[]] = [points(n, Math.sin), points(n, Math.cos)];
    const large: [number[], number[]] = [points(4 * n, Math.sin), points(4 * n, Math.cos)];
    const sample = ([a, b]: [number[], number[]]): number => {
      const t0 = performance.now();
      wassersteinDistance(a, b);
      return performance.now() - t0;
    };
    sample(small);
    sample(large);
    let smallMs = Infinity;
    let largeMs = Infinity;
    for (let k = 0; k < 7; k++) {
      smallMs = Math.min(smallMs, sample(small));
      largeMs = Math.min(largeMs, sample(large));
    }
    expect(largeMs / Math.max(smallMs, 0.01)).toBeLessThan(10);
  });
});
