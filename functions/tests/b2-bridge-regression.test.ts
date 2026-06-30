import { describe, it, expect } from 'vitest';
import { reshape, det } from '@danielsimonjr/mathts-functions';

/**
 * GC13 / N9 — regression guards for the matrix factory bridge (B2).
 *
 * mathjs factories capture their dependencies at creation time, so the ORDER of
 * bindings in factories/index.ts silently determines whether `reshape`/`det` see
 * a real dependency or a tier-ordering stub. These tests pin the observable
 * behaviour so a future reorder can't regress it unnoticed.
 */
describe('GC13: B2 factory-bridge regression guards', () => {
  it('reshape rejects a non-integer dimension (captured isInteger works)', () => {
    expect(() => reshape([[1, 2, 3, 4]], [2.5, 2])).toThrow(/Invalid size|integer/i);
  });

  it('reshape reshapes with valid integer dimensions', () => {
    expect(reshape([[1, 2, 3, 4]], [2, 2])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('det computes correctly despite its multiplyScalar binding (numeric matrices)', () => {
    expect(det([[2, 0, 1], [1, 3, 2], [0, 1, 4]])).toBeCloseTo(21, 10);
    expect(det([[1, 2], [3, 4]])).toBeCloseTo(-2, 10);
  });
});
