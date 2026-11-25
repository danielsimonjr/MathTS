import { describe, it } from 'vitest';
import { expectSame } from './differential.js';

/**
 * G10 — `eigs` precision and vector scale (#1561).
 *
 * The three issue rows, each compared with the mathjs 15.3.0 oracle through the
 * differential harness (`typeOf` plus `format(value, { precision: 14 })`):
 *
 * 1. `eigs([[1, 2], [3, 4]], 2).values` is `[0, 5]` — a loose `precision` takes
 *    effect (the compat public export ignored it through the native bypass).
 * 2. `eigs([[4, 1], [2, 3]]).eigenvectors[1].vector` is about
 *    `[1.7888543819998, 1.7888543819998]` — mathjs does not unit-normalize the
 *    eigenvectors; the compat native path did.
 * 3. `eigs([[1, 2, 3], [4, 5, 6], [7, 8, 9]], { precision: 1e-6,
 *    eigenvectors: false }).values` matches the oracle, including the
 *    `2.02e-10` entry that a loose precision leaves in the spectrum.
 */

type Eigs = (
  m: unknown,
  opts?: unknown
) => {
  values: unknown;
  eigenvectors?: { value: unknown; vector: unknown }[];
};

const valuesOf = (L: Record<string, unknown>, m: number[][], opts?: unknown): unknown =>
  ((L.eigs as Eigs)(m, opts) as { values: unknown }).values;

const vectorAt = (L: Record<string, unknown>, m: number[][], i: number): unknown => {
  const r = (L.eigs as Eigs)(m);
  const vectors = r.eigenvectors;
  if (!Array.isArray(vectors) || vectors.length <= i) {
    throw new Error(`no eigenvector at index ${i}`);
  }
  return vectors[i].vector;
};

describe('G10 eigs precision and vector scale (#1561)', () => {
  it('eigs([[1,2],[3,4]], 2) has the oracle values [0, 5]', () => {
    expectSame('eigs values at precision 2', {}, (L) =>
      valuesOf(
        L,
        [
          [1, 2],
          [3, 4],
        ],
        2
      )
    );
  });

  it('removed known-gaps precision 1/2.5/3 match the oracle (B6)', () => {
    for (const p of [1, 2.5, 3]) {
      expectSame(`eigs values at precision ${p}`, {}, (L) =>
        valuesOf(
          L,
          [
            [1, 2],
            [3, 4],
          ],
          p
        )
      );
    }
  });

  it('eigs([[4,1],[2,3]]) has the oracle eigenvector scale', () => {
    expectSame('eigs eigenvector at index 1', {}, (L) =>
      vectorAt(
        L,
        [
          [4, 1],
          [2, 3],
        ],
        1
      )
    );
    expectSame('eigs eigenvector at index 0', {}, (L) =>
      vectorAt(
        L,
        [
          [4, 1],
          [2, 3],
        ],
        0
      )
    );
  });

  it('eigs([[1,2,3],[4,5,6],[7,8,9]], {precision: 1e-6, eigenvectors: false}) has the oracle values', () => {
    expectSame('eigs values at precision 1e-6 without eigenvectors', {}, (L) =>
      valuesOf(
        L,
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        { precision: 1e-6, eigenvectors: false }
      )
    );
  });
});
