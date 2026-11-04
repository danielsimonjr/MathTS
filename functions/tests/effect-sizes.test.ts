import { describe, it, expect } from 'vitest';
import {
  cohensD,
  hedgesG,
  glassDelta,
  etaSquared,
  rankBiserial,
} from '../src/stats/effect-sizes.js';

const A = [1, 2, 3];
const B = [4, 5, 6];

describe('effect sizes', () => {
  it('cohensD', () => {
    expect(cohensD(A, B)).toBeCloseTo(-3, 12);
  });
  it('hedgesG applies the small-sample correction', () => {
    expect(hedgesG(A, B)).toBeCloseTo(-2.4, 12);
  });
  it('glassDelta uses the sd of the second group', () => {
    expect(glassDelta(A, B)).toBeCloseTo(-3, 12);
  });
  it('etaSquared = SS_between / SS_total (13.5 / 17.5)', () => {
    expect(etaSquared([A, B])).toBeCloseTo(0.7714285714285715, 12);
  });
  it('rankBiserial is -1 for fully separated samples and 0 for identical ones', () => {
    expect(rankBiserial(A, B)).toBeCloseTo(-1, 12);
    expect(rankBiserial(B, A)).toBeCloseTo(1, 12);
    expect(rankBiserial([1, 2], [1, 2])).toBeCloseTo(0, 12);
  });
  it('rankBiserial rejects empty samples', () => {
    expect(() => rankBiserial([], [1])).toThrow(RangeError);
  });
});

describe('effect-sizes small samples', () => {
  it('throws RangeError for samples too small', async () => {
    const m = await import('../src/stats/effect-sizes.js');
    expect(() => m.cohensD([1], [2])).toThrow(RangeError);
    expect(() => m.hedgesG([1], [2, 3])).toThrow(RangeError);
    expect(() => m.glassDelta([1, 2], [3])).toThrow(RangeError);
  });
});
