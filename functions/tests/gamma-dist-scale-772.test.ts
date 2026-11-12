import { describe, it, expect } from 'vitest';
import { gammaDist } from '../src/typed/dist-objects.js';

/**
 * SciPy `scipy.stats.gamma(a, scale=scale)` reference values (SciPy 1.17).
 * Rate form is `gammaDist(shape, 1/scale)`.
 */
const CASES: {
  shape: number;
  scale: number;
  x: number;
  pdf: number;
  cdf: number;
  q50: number;
}[] = [
  // pdf/cdf at x=1 unless a tail value is the stable one (large shape, or x near the mass)
  {
    shape: 2,
    scale: 0.5,
    x: 1,
    pdf: 0.5413411329464508,
    cdf: 0.5939941502901616,
    q50: 0.8391734950083306,
  },
  {
    shape: 2,
    scale: 2,
    x: 1,
    pdf: 0.15163266492815833,
    cdf: 0.09020401043104986,
    q50: 3.3566939800333224,
  },
  {
    shape: 0.5,
    scale: 1.5,
    x: 1,
    pdf: 0.23651014781891844,
    cdf: 0.7517869210100764,
    q50: 0.341202317339679,
  },
  {
    shape: 0.3,
    scale: 0.2,
    x: 0.1,
    pdf: 1.6468147110855227,
    cdf: 0.8138118046743924,
    q50: 0.014626227173390398,
  },
  {
    shape: 10,
    scale: 3,
    x: 5,
    pdf: 1.7215923431365906e-5,
    cdf: 1.0119673258770548e-5,
    q50: 29.006143844142386,
  },
  {
    shape: 100,
    scale: 0.25,
    x: 5,
    pdf: 5.5993326509980446e-36,
    cdf: 3.488878669689553e-37,
    q50: 24.91671622982887,
  },
  {
    shape: 1,
    scale: 1,
    x: 1,
    pdf: 0.36787944117144233,
    cdf: 0.6321205588285577,
    q50: 0.6931471805599455,
  },
];

/** Issue #772 — gammaDist rate vs SciPy scale. */
describe('#772 gammaDist rate vs SciPy scale', () => {
  it('rate parameterization: gammaDist(2, 2).pdf(1) matches SciPy scale=0.5', () => {
    const d = gammaDist(2, 2);
    expect(d.pdf(1)).toBeCloseTo(0.5413411329464507, 12);
    expect(d.mean).toBe(1);
    expect(d.variance).toBe(0.5);
  });

  it('scale option: gammaDist(2, { scale: 2 }).pdf(1) matches SciPy', () => {
    const d = gammaDist(2, { scale: 2 });
    expect(d.pdf(1)).toBeCloseTo(0.15163266492815836, 12);
    expect(d.mean).toBe(4);
    expect(d.variance).toBe(8);
  });

  it('scale option object form gammaDist({ shape: 2, scale: 2 })', () => {
    const d = gammaDist({ shape: 2, scale: 2 });
    expect(d.pdf(1)).toBeCloseTo(0.15163266492815836, 12);
    expect(d.mean).toBe(4);
    expect(d.variance).toBe(8);
  });

  it('pdf, cdf, quantile, mean, and variance match SciPy across shapes', () => {
    for (const c of CASES) {
      const byScale = gammaDist(c.shape, { scale: c.scale });
      const byRate = gammaDist(c.shape, 1 / c.scale);
      const named = gammaDist({ shape: c.shape, scale: c.scale });
      for (const d of [byScale, byRate, named]) {
        expect(d.mean).toBeCloseTo(c.shape * c.scale, 12);
        expect(d.variance).toBeCloseTo(c.shape * c.scale * c.scale, 12);
        expect(d.pdf(c.x)).toBeCloseTo(c.pdf, 10);
        expect(d.cdf(c.x)).toBeCloseTo(c.cdf, 8);
        expect(d.quantile(0.5)).toBeCloseTo(c.q50, 6);
      }
      expect(byScale.pdf(c.x)).toBeCloseTo(byRate.pdf(c.x), 12);
      expect(byScale.cdf(c.x)).toBeCloseTo(byRate.cdf(c.x), 12);
    }
  });

  it('seeded sampleN honors scale = 1/rate', async () => {
    for (const c of CASES) {
      const scaleSamples = await gammaDist(c.shape, { scale: c.scale }).sampleN(4000, { seed: 7 });
      const rateSamples = await gammaDist(c.shape, 1 / c.scale).sampleN(4000, { seed: 7 });
      expect(Array.from(scaleSamples)).toEqual(Array.from(rateSamples));
      let sum = 0;
      for (let i = 0; i < scaleSamples.length; i++) sum += scaleSamples[i]!;
      const mean = sum / scaleSamples.length;
      const se = Math.sqrt((c.shape * c.scale * c.scale) / scaleSamples.length);
      expect(Math.abs(mean - c.shape * c.scale)).toBeLessThan(6 * se);
    }
  });

  it('rejects rate and scale together', () => {
    expect(() => gammaDist(2, { scale: 2, rate: 1 } as { scale: number })).toThrow(/not both/);
    expect(() =>
      gammaDist({ shape: 2, scale: 2, rate: 1 } as { shape: number; scale: number })
    ).toThrow(/not both/);
    // @ts-expect-error options form must not take a second positional rate
    expect(() => gammaDist({ shape: 2, scale: 2 }, 1)).toThrow(/not both/);
  });

  it('rejects non-positive, NaN, and non-finite parameters', () => {
    const bad = [0, -1, NaN, Infinity, -Infinity];
    for (const v of bad) {
      expect(() => gammaDist(v, 1)).toThrow(/shape/);
      expect(() => gammaDist(2, v)).toThrow(/rate/);
      expect(() => gammaDist(2, { scale: v })).toThrow(/scale/);
      expect(() => gammaDist({ shape: v, scale: 1 })).toThrow(/shape/);
      expect(() => gammaDist({ shape: 2, scale: v })).toThrow(/scale/);
    }
  });
});
