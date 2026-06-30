import { describe, it, expect } from 'vitest';
import {
  generalizedEig,
  cauchyPDF,
  cauchyCDF,
  cauchyQuantile,
  laplacePDF,
  laplaceCDF,
  laplaceQuantile,
  logisticPDF,
  logisticCDF,
  logisticQuantile,
} from '@danielsimonjr/mathts-functions';

/**
 * Wave D (batch 2) — generalized eigenproblem + distribution breadth. Reference
 * values from scipy.linalg.eig(A,B) and scipy.stats.{cauchy,laplace,logistic}.
 * generalizedEig reuses inv + multiply + the corrected eigs; the distributions are
 * closed forms.
 */
describe('gap Wave D — generalizedEig (vs scipy.linalg.eig(A,B))', () => {
  it('A x = λ B x eigenvalues', () => {
    const v = generalizedEig(
      [
        [2, 1],
        [1, 3],
      ],
      [
        [1, 0],
        [0, 2],
      ]
    )
      .values.map((z) => (typeof z === 'object' ? z.re : z))
      .sort((a, b) => a - b);
    expect(v[0]).toBeCloseTo(1.0, 9);
    expect(v[1]).toBeCloseTo(2.5, 9);
  });

  it('reduces to the standard eigenproblem when B = I', () => {
    const v = generalizedEig(
      [
        [2, 0],
        [0, 5],
      ],
      [
        [1, 0],
        [0, 1],
      ]
    )
      .values.map((z) => (typeof z === 'object' ? z.re : z))
      .sort((a, b) => a - b);
    expect(v).toEqual([2, 5]);
  });
});

describe('gap Wave D — distribution breadth (vs scipy.stats)', () => {
  it('cauchy pdf/cdf/quantile', () => {
    expect(cauchyPDF(1)).toBeCloseTo(0.15915494309189535, 12);
    expect(cauchyCDF(1)).toBeCloseTo(0.75, 12);
    expect(cauchyQuantile(0.75)).toBeCloseTo(1.0, 12);
  });
  it('laplace pdf/cdf/quantile', () => {
    expect(laplacePDF(1)).toBeCloseTo(0.18393972058572117, 12);
    expect(laplaceCDF(1)).toBeCloseTo(0.8160602794142788, 12);
    expect(laplaceQuantile(0.25)).toBeCloseTo(-0.6931471805599453, 12);
  });
  it('logistic pdf/cdf/quantile', () => {
    expect(logisticPDF(1)).toBeCloseTo(0.19661193324148185, 12);
    expect(logisticCDF(1)).toBeCloseTo(0.7310585786300049, 12);
    expect(logisticQuantile(0.9)).toBeCloseTo(2.1972245773362196, 12);
  });
  it('CDF/quantile round-trip for each family', () => {
    for (const [cdf, q] of [
      [cauchyCDF, cauchyQuantile],
      [laplaceCDF, laplaceQuantile],
      [logisticCDF, logisticQuantile],
    ] as const) {
      for (const p of [0.1, 0.4, 0.85]) expect(cdf(q(p))).toBeCloseTo(p, 10);
    }
  });
});
