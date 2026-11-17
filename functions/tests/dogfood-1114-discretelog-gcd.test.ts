/**
 * Dogfood #1114: discreteLog(g, h, p) when g and p share a factor.
 *
 * Expected values come from a brute-force loop over the powers of g (smallest x >= 0 with
 * g^x === h mod p; -1 when none exists), checked against every (p, g, h) with 2 <= p <= 200.
 */
import { describe, it, expect } from 'vitest';
import { discreteLog } from '../src/index.js';

describe('discreteLog with gcd(g, p) > 1 (#1114)', () => {
  it.each([
    // [g, h, p, expected]
    [2, 6, 10, 4], // 2^4 = 16 === 6 (old: 5)
    [2, 4, 6, 2],
    [0, 0, 2, 1], // old: -1
    [0, 0, 7, 1],
    [2, 0, 8, 3],
    [6, 0, 12, 2],
    [4, 4, 12, 1],
    [10, 0, 100, 2],
    [3, 9, 18, 2],
    [5, 25, 50, 2],
    [2, 8, 12, 3],
  ])('discreteLog(%i, %i, %i) = %i', (g, h, p, expected) => {
    expect(discreteLog(g, h, p)).toBe(expected);
  });

  it.each([
    [0, 2, 6], // old: 4
    [3, 0, 18],
    [2, 3, 6],
  ])('discreteLog(%i, %i, %i) = -1 (no solution)', (g, h, p) => {
    expect(discreteLog(g, h, p)).toBe(-1);
  });

  it('keeps x = 0 for h === 1', () => {
    expect(discreteLog(0, 1, 5)).toBe(0);
    expect(discreteLog(2, 1, 6)).toBe(0);
  });

  it('solves a large composite modulus', () => {
    expect(discreteLog(2, 1491082, 2000006)).toBe(100000);
    expect(discreteLog(6, 3115080, 5999898)).toBe(5000);
  });

  it('returns for a huge power-of-two modulus (the reduction ends the walk)', () => {
    expect(discreteLog(2, 2 ** 40, 2 ** 52)).toBe(40);
    expect(discreteLog(2, 3, 2 ** 52)).toBe(-1);
  });
});
