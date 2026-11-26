import { describe, it, expect } from 'vitest';
import { eigs } from '@danielsimonjr/mathts-functions';

/**
 * G10 CHALLENGER — the native/factory boundary.
 *
 * A test that "compat matches mathjs" is vacuously true while compat IS the rewired native
 * export. The real requirement is that the quirks compat must copy are NOT reached through
 * the native symbol. When a real adapter lands (native solver + a compat wrapper), these
 * stay green; if the native export is re-pointed at the mathjs factory again, they fail and
 * say why.
 */

describe('G10 boundary: native eigs must not carry mathjs’s precision quirk', () => {
  it('native eigs([[1,2],[3,4]], precision 2) keeps the true spectrum, not [0, 5]', () => {
    // NumPy: -0.3722813232690143, 5.372281323269014. mathjs 15.3.0 returns [0, 5] here;
    // that quirk belongs in compat, so the NATIVE symbol must not reproduce it.
    const r = eigs(
      [
        [1, 2],
        [3, 4],
      ],
      2 as never
    ) as unknown as { values: number[] };
    const v = [...r.values].sort((a, b) => a - b);
    expect(v[0]).toBeCloseTo(-0.3722813232690143, 6);
    expect(v[1]).toBeCloseTo(5.372281323269014, 6);
  });

  it('native eigs keeps the eigenpair identity A v = lambda v even with a loose precision', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    const r = eigs(A, 2 as never) as unknown as {
      eigenvectors: { value: number; vector: number[] }[];
    };
    for (const p of r.eigenvectors) {
      const norm = Math.hypot(...p.vector);
      for (let i = 0; i < 2; i++) {
        const row = A[i][0] * p.vector[0] + A[i][1] * p.vector[1];
        expect(Math.abs(row - p.value * p.vector[i]) / norm).toBeLessThan(1e-9);
      }
    }
  });
});
