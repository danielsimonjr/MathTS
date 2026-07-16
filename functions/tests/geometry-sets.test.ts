import { describe, it, expect } from 'vitest';
import {
  quaternionToEuler,
  quaternionSlerp,
  quaternionInverse,
  boundingBox,
  setEqual,
  setIsSuperset,
  setDisjoint,
} from '../src/index.js';

describe('geometry + sets', () => {
  it('quaternionToEuler(identity) = [0,0,0]', () => {
    quaternionToEuler([1, 0, 0, 0]).forEach((a) => expect(a).toBeCloseTo(0, 8));
  });
  it('quaternionInverse of a unit quaternion = conjugate', () => {
    const q = [0, 1, 0, 0]; // unit
    const inv = quaternionInverse(q);
    expect(inv[0]).toBeCloseTo(0, 8);
    expect(inv[1]).toBeCloseTo(-1, 8);
  });
  it('quaternionSlerp endpoints', () => {
    const q1 = [1, 0, 0, 0],
      q2 = [0, 1, 0, 0];
    quaternionSlerp(q1, q2, 0).forEach((v, i) => expect(v).toBeCloseTo(q1[i], 8));
    quaternionSlerp(q1, q2, 1).forEach((v, i) => expect(v).toBeCloseTo(q2[i], 8));
  });
  it('boundingBox', () => {
    expect(
      boundingBox([
        [1, 2],
        [3, 0],
        [2, 5],
      ])
    ).toEqual({ min: [1, 0], max: [3, 5] });
  });
  it('multiset ops', () => {
    expect(setEqual([1, 2, 2], [2, 1, 2])).toBe(true);
    expect(setEqual([1, 2], [1, 2, 2])).toBe(false);
    expect(setIsSuperset([1, 2, 3], [1, 2])).toBe(true);
    expect(setIsSuperset([1, 2], [1, 2, 3])).toBe(false);
    expect(setDisjoint([1, 2], [3, 4])).toBe(true);
    expect(setDisjoint([1, 2], [2, 3])).toBe(false);
  });
});
