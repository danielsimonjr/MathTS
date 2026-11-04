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
