import { describe, it, expect } from 'vitest';
import {
  owensT,
  skewNormalPDF,
  skewNormalCDF,
  truncatedNormalPDF,
  truncatedNormalCDF,
  truncatedNormalMean,
  inverseGammaPDF,
  inverseGammaCDF,
  gevCDF,
  gevPDF,
  skellamPMF,
  zipfPMF,
  nakagamiPDF,
  ricePDF,
} from '../src/stats/distributions-extra.js';
import { quad } from '../src/numeric/adaptive-quad.js';
import { normalPDF, normalCDF } from '../src/typed/distributions.js';

const phi = (z: number): number => normalPDF(z) as number;
const Phi = (z: number): number => normalCDF(z) as number;

describe('owensT and skew-normal', () => {
  it('owensT matches closed-form points', () => {
    expect(owensT(0, 1)).toBeCloseTo(0.125, 12);
    expect(owensT(1, 1)).toBeCloseTo(0.06674188216570097, 9);
    expect(owensT(0.5, 0)).toBe(0);
  });
  it('skew-normal PDF and CDF at the origin', () => {
    expect(skewNormalPDF(0, 0)).toBeCloseTo(0.3989422804014327, 12);
    expect(skewNormalCDF(0, 1)).toBeCloseTo(0.25, 9);
    expect(skewNormalCDF(0, 0)).toBeCloseTo(0.5, 12);
  });
});

describe('truncated normal', () => {
  it('PDF on [-1, 1] is φ(0) / (Φ(1) − Φ(−1))', () => {
    expect(truncatedNormalPDF(0, -1, 1)).toBeCloseTo(phi(0) / (Phi(1) - Phi(-1)), 9);
    expect(truncatedNormalPDF(2, -1, 1)).toBe(0);
  });
  it('CDF goes from 0 to 1 across the support', () => {
    expect(truncatedNormalCDF(-1, -1, 1)).toBe(0);
    expect(truncatedNormalCDF(1, -1, 1)).toBe(1);
    expect(truncatedNormalCDF(0, -1, 1)).toBeCloseTo(0.5, 9);
  });
  it('mean on [0, ∞) is the half-normal mean', () => {
    expect(truncatedNormalMean(0, Infinity)).toBeCloseTo(0.7978845608028654, 9);
  });
  it('rejects a >= b', () => {
    expect(() => truncatedNormalPDF(0, 1, 1)).toThrow(RangeError);
    expect(() => truncatedNormalMean(2, -2)).toThrow(RangeError);
  });
});

describe('inverse gamma', () => {
  it('CDF(1; 1, 1) = e⁻¹', () => {
    expect(inverseGammaCDF(1, 1, 1)).toBeCloseTo(0.36787944117144233, 9);
  });
  it('mean is β/(α−1) = 1 for α = 3, β = 2 (quadrature check)', () => {
    const r = quad((x: number) => x * inverseGammaPDF(x, 3, 2), 0, 1e6, { tol: 1e-10 });
    expect(r.value).toBeCloseTo(1, 4);
  });
  it('PDF is zero for x <= 0', () => {
    expect(inverseGammaPDF(0, 2, 1)).toBe(0);
  });
});

describe('GEV', () => {
  it('Gumbel case (ξ = 0)', () => {
    expect(gevCDF(0, 0)).toBeCloseTo(0.36787944117144233, 12);
    expect(gevPDF(0, 0)).toBeCloseTo(0.36787944117144233, 12);
  });
  it('heavy and bounded tails', () => {
    expect(gevCDF(1, 0.5)).toBeCloseTo(Math.exp(-1 / 2.25), 12);
    expect(gevCDF(1, -0.5)).toBeCloseTo(Math.exp(-0.25), 12);
  });
  it('outside support: CDF 0 or 1, PDF 0', () => {
    expect(gevCDF(-3, 0.5)).toBe(0); // lower bound -1/ξ... below support for ξ > 0
    expect(gevCDF(5, -1)).toBe(1); // above upper bound for ξ < 0
    expect(gevPDF(-3, 0.5)).toBe(0);
  });
});

describe('discrete and Bessel-based laws', () => {
  it('Skellam PMF(0; 1, 1) = e⁻² I₀(2)', () => {
    expect(skellamPMF(0, 1, 1)).toBeCloseTo(0.30850832251, 9);
  });
  it('Skellam is symmetric in k sign via I_|k|', () => {
    expect(skellamPMF(-2, 1, 3)).toBeCloseTo(skellamPMF(2, 3, 1), 12);
  });
  it('Skellam requires positive means', () => {
    expect(() => skellamPMF(0, 0, 1)).toThrow(RangeError);
  });
  it('Zipf PMF(1; 1, 3) = 6/11', () => {
    expect(zipfPMF(1, 1, 3)).toBeCloseTo(6 / 11, 12);
    expect(zipfPMF(4, 1, 3)).toBe(0);
  });
  it('Nakagami PDF(1; 1, 1) = 2e⁻¹', () => {
    expect(nakagamiPDF(1, 1, 1)).toBeCloseTo(0.7357588823428847, 12);
  });
  it('Rice PDF(1; 0, 1) = e^(−1/2)', () => {
    expect(ricePDF(1, 0, 1)).toBeCloseTo(0.6065306597126334, 12);
  });
});

describe('review fixes: tails and large-argument Rice', () => {
  it('truncated normal tails are finite and accurate', async () => {
    const m = await import('../src/stats/distributions-extra.js');
    expect(m.truncatedNormalMean(10, Infinity)).toBeCloseTo(10.098, 3);
    expect(m.truncatedNormalMean(-Infinity, -40)).toBeCloseTo(-40.0249, 3);
    const m910 = m.truncatedNormalMean(9, 10);
    expect(m910).toBeGreaterThan(9);
    expect(m910).toBeLessThan(10);
    const p = m.truncatedNormalPDF(41, 40, Infinity);
    expect(p).toBeGreaterThan(0);
    expect(Number.isFinite(p)).toBe(true);
    expect(m.truncatedNormalCDF(40.5, 40, Infinity)).toBeCloseTo(1, 6);
    expect(m.truncatedNormalCDF(-40.5, -Infinity, -40)).toBeCloseTo(0, 6);
  });

  it('ricePDF(50, 49, 1) is finite', async () => {
    const m = await import('../src/stats/distributions-extra.js');
    expect(m.ricePDF(50, 49, 1)).toBeCloseTo(0.24444, 4);
  });
});
