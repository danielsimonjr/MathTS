import { describe, it, expect } from 'vitest';
import { expm } from '@danielsimonjr/mathts-functions';

/**
 * Regression + oracle pins for the CANONICAL public `expm` (matrix exponential).
 *
 * B2 / bug: the public `expm` was the factory-pattern Padé implementation, which
 * was created inside the window where `factoryScope.multiply` is temporarily bound
 * to `multiplyScalar` (for `det`), so it captured a scalar-only multiply and threw
 * on ANY matrix input (`multiplyScalar` rejects `DenseMatrix|Matrix`); it also lacked
 * an `Array` signature (`A.size is not a function` on a raw `number[][]`). The working,
 * accelerated implementation lived under the non-canonical name `matrixExpm`. The fix
 * routes the canonical `expm` to that native path.
 *
 * Oracles are closed-form:
 *   - expm(0) = I.
 *   - expm(diag(2,3)) = diag(e², e³) (exponential of a diagonal is elementwise).
 *   - expm([[0,1],[0,0]]) = [[1,1],[0,1]] (nilpotent N: e^N = I + N).
 * See [[feedback-oracle-tests-implementation-independent]].
 */
describe('expm — canonical public matrix exponential', () => {
  it('expm(0₂) = I₂', () => {
    const R = expm([
      [0, 0],
      [0, 0],
    ]) as number[][];
    expect(R[0][0]).toBeCloseTo(1, 12);
    expect(R[1][1]).toBeCloseTo(1, 12);
    expect(R[0][1]).toBeCloseTo(0, 12);
    expect(R[1][0]).toBeCloseTo(0, 12);
  });

  it('expm(diag(2,3)) = diag(e², e³)', () => {
    const R = expm([
      [2, 0],
      [0, 3],
    ]) as number[][];
    expect(R[0][0]).toBeCloseTo(Math.exp(2), 8);
    expect(R[1][1]).toBeCloseTo(Math.exp(3), 8);
    expect(R[0][1]).toBeCloseTo(0, 10);
    expect(R[1][0]).toBeCloseTo(0, 10);
  });

  it('expm([[0,1],[0,0]]) = [[1,1],[0,1]] (nilpotent: e^N = I + N)', () => {
    const R = expm([
      [0, 1],
      [0, 0],
    ]) as number[][];
    expect(R[0][0]).toBeCloseTo(1, 12);
    expect(R[0][1]).toBeCloseTo(1, 12);
    expect(R[1][0]).toBeCloseTo(0, 12);
    expect(R[1][1]).toBeCloseTo(1, 12);
  });
});
