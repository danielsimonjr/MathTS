import { describe, it, expect } from 'vitest';
import { pair, show } from './oracle.js';

/**
 * G10 CHALLENGER — the compat adapter must own mathjs's `eigs` quirks, and only compat.
 *
 * Policy: `mathts-compat` copies mathjs 15.3.0 exactly (quirks included) and does so as a
 * THIN adapter over native code. `@danielsimonjr/mathts-functions` (critical library) keeps
 * its native contract. Today compat passes only because the builder rewired the NATIVE
 * `eigs`; restoring the native solver will break these unless compat grows a real adapter.
 * These assertions are the requirement the adapter has to meet.
 *
 * Oracle: mathjs 15.3.0 (the `mathjs` devDependency).
 */

type Lib = Record<string, unknown>;

describe('G10 compat: mathjs eigs quirks live in compat/, not in native', () => {
  it('compat returns a Matrix (not an Array) for a Matrix input, as the oracle does', () => {
    const { mathjs, compat } = pair({});
    const shape = (L: Lib): string[] => {
      const r = (
        L.eigs as (m: unknown) => { values: unknown; eigenvectors: { vector: unknown }[] }
      )(
        (L.matrix as (m: unknown) => unknown)([
          [5, 2.3],
          [2.3, 1],
        ])
      );
      const kind = (x: unknown): string =>
        (x as { type?: string }).type ?? (Array.isArray(x) ? 'Array' : typeof x);
      return [kind(r.values), kind(r.eigenvectors[0].vector)];
    };
    expect(shape(compat)).toEqual(shape(mathjs));
    expect(shape(compat)).toEqual(['DenseMatrix', 'DenseMatrix']);
  });

  it('compat reproduces mathjs’s non-unit eigenvector scale (the (b) quirk)', () => {
    const { mathjs, compat } = pair({});
    const vectorAt = (L: Lib): unknown =>
      (L.eigs as (m: unknown) => { eigenvectors: { vector: unknown }[] })([
        [4, 1],
        [2, 3],
      ]).eigenvectors[1].vector;
    // 1.7888543819998313, 1.7888543819998315 — the oracle's scale.
    expect(show(compat, vectorAt(compat))).toBe(show(mathjs, vectorAt(mathjs)));
  });

  it('compat reproduces mathjs’s loose-precision collapse to [0, 5]', () => {
    const { mathjs, compat } = pair({});
    const values = (L: Lib): unknown =>
      (L.eigs as (m: unknown, p: number) => { values: unknown })(
        [
          [1, 2],
          [3, 4],
        ],
        2
      ).values;
    expect(show(compat, values(compat))).toBe(show(mathjs, values(mathjs)));
    expect(show(compat, values(compat))).toContain('0');
  });

  it('compat reproduces mathjs’s value order (+i member of a conjugate pair first)', () => {
    const { mathjs, compat } = pair({});
    const values = (L: Lib): unknown =>
      (L.eigs as (m: unknown) => { values: unknown })([
        [0, -1],
        [1, 0],
      ]).values;
    expect(show(compat, values(compat))).toBe(show(mathjs, values(mathjs)));
  });

  it('compat reproduces the 3x3 loose-precision noise entry (2.02e-10)', () => {
    const { mathjs, compat } = pair({});
    const values = (L: Lib): unknown =>
      (L.eigs as (m: unknown, o: unknown) => { values: unknown })(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        { precision: 1e-6, eigenvectors: false }
      ).values;
    expect(show(compat, values(compat))).toBe(show(mathjs, values(mathjs)));
  });
});
