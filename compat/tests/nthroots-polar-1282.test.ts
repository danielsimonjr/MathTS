/**
 * #1282 through the compat instance: `nthRoots` returns roots with number parts.
 * The expected values are the mathjs 15.2.0 results (bit exact).
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { create, all } from '../src/index.js';

const math = create(all) as unknown as {
  nthRoots: (x: unknown, n?: number) => Complex[];
  complex: (re: number, im: number) => unknown;
};

describe('compat nthRoots builds each root from polar form (#1282)', () => {
  it('cube roots of 8i have number parts', () => {
    const got = math.nthRoots(math.complex(0, 8), 3);
    expect(got).toHaveLength(3);
    got.forEach((root) => {
      expect(typeof root.re).toBe('number');
      expect(typeof root.im).toBe('number');
    });
    expect(got.map((r) => [r.re, r.im])).toEqual([
      [1.7320508075688774, 0.9999999999999999],
      [-1.7320508075688774, 0.9999999999999999],
      [0, -2],
    ]);
  });

  it('cube roots of -8 (real input) have number parts', () => {
    const got = math.nthRoots(-8, 3);
    expect(got.map((r) => [r.re, r.im])).toEqual([
      [1.0000000000000002, 1.7320508075688772],
      [-2, 0],
      [1.0000000000000002, -1.7320508075688772],
    ]);
  });
});
