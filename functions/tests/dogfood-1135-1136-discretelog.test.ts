/**
 * Dogfood #1136 and #1135: discreteLog above 2^48 and the baby-step table.
 *
 * #1136: a small answer above 2^48 returned a RangeError, because the order of g was searched
 * before h. #1135: the baby-step Map peaked at about 1 GB; a typed-array table replaces it,
 * and the baby steps stop when the powers of g return to 1.
 * Expected values come from a brute-force loop over the powers of g (smallest x >= 0 with
 * g^x === h mod p; -1 when none exists).
 */
import { describe, it, expect } from 'vitest';
import { discreteLog } from '../src/index.js';

function brute(g: number, h: number, p: number): number {
  const target = ((h % p) + p) % p;
  let c = 1 % p;
  for (let x = 0; x <= p + 1; x++) {
    if (c === target) return x;
    c = (c * (g % p)) % p;
  }
  return -1;
}

describe('discreteLog small answer above 2^48 (#1136)', () => {
  it.each([
    [3, 9, 2 ** 53 - 111, 2],
    [6, 36, 9007199254740898, 2],
    [2, 1, 2 ** 53 - 111, 0],
    [2, 2, 2 ** 53 - 111, 1],
    [2, 2 ** 40, 2 ** 53 - 111, 40],
    [3, 3 ** 20, 2 ** 52 + 5, 20],
  ])('discreteLog(%i, %i, %i) = %i', (g, h, p, expected) => {
    expect(discreteLog(g, h, p)).toBe(expected);
  });

  it('returns -1 when the walk returns to 1 before it finds h', () => {
    const p = 2 ** 53 - 111;
    expect(discreteLog(p - 1, 5, p)).toBe(-1);
    expect(discreteLog(p - 1, p - 1, p)).toBe(1);
  });

  it('still throws when the order of g is above the limit and h is not found', () => {
    expect(() => discreteLog(3, 2 ** 52 + 12345, 2 ** 53 - 111)).toThrow(RangeError);
  });
});

describe('discreteLog baby-step table (#1135)', () => {
  it('matches a brute-force loop for every g, h and p <= 150', () => {
    const mismatches: string[] = [];
    for (let p = 2; p <= 150; p++) {
      for (let g = 0; g < p; g++) {
        for (let h = 0; h < p; h++) {
          if (discreteLog(g, h, p) !== brute(g, h, p)) mismatches.push(`${g},${h},${p}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  }, 120_000);

  it('matches a brute-force loop for moduli of a few thousand, with colliding table slots', () => {
    const mismatches: string[] = [];
    for (const p of [1009, 2048, 3001, 4096, 6561, 9973]) {
      for (const g of [2, 3, 5, 6, 10, p - 1]) {
        for (let h = 0; h < p; h += 7) {
          if (discreteLog(g, h, p) !== brute(g, h, p)) mismatches.push(`${g},${h},${p}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  }, 120_000);

  it('stops the baby steps when the powers of g return to 1', () => {
    // 2 has order 44 mod 2^44 - 1, and m = 2^22. A full table and a full giant-step loop take
    // seconds; the 44 powers take less than a millisecond.
    const p = 2 ** 44 - 1;
    const start = performance.now();
    expect(discreteLog(2, 7, p)).toBe(-1);
    expect(discreteLog(2, 2 ** 43, p)).toBe(43);
    expect(discreteLog(2, 1, p)).toBe(0);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('separates two baby steps that share their 32-bit table key', () => {
    // 3^13825 = 39112975671 and 3^102725 = 60996404640 (mod 68719476731) have the same
    // 32-bit hash in the table. A lookup must compare the full values.
    const p = 68719476731;
    expect(discreteLog(3, 39112975671, p)).toBe(13825);
    expect(discreteLog(3, 60996404640, p)).toBe(102725);
  });

  it('keeps short probe chains when the powers of g differ only above bit 32', () => {
    // The powers of 2^22 + 1 modulo 2^44 are 1 + j * 2^22: 2^22 values with 1024 distinct
    // low halves. A table key of the low 32 bits only takes more than 20 s here.
    const start = performance.now();
    expect(discreteLog(2 ** 22 + 1, 3, 2 ** 44)).toBe(-1);
    expect(performance.now() - start).toBeLessThan(10_000);
  }, 100_000);

  it('stores no baby step in a Map', () => {
    const set = Map.prototype.set;
    let calls = 0;
    Map.prototype.set = function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      calls++;
      return set.call(this, key, value);
    } as typeof set;
    try {
      expect(discreteLog(7, 12345, 1000003)).toBeGreaterThan(0);
    } finally {
      Map.prototype.set = set;
    }
    expect(calls).toBe(0);
  });

  it('finds the smallest x when the powers of g repeat', () => {
    // 3 has order 4 mod 80, so its powers repeat from x = 4.
    expect(discreteLog(3, 1, 80)).toBe(0);
    expect(discreteLog(3, 3, 80)).toBe(1);
    expect(discreteLog(3, 81 % 80, 80)).toBe(0);
  });
});
