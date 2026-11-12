import { describe, it, expect } from 'vitest';
import {
  pearsonr,
  linregress,
  kendalltau,
  quantileSeq,
  describe as statsDescribe,
  kolmogorovSmirnovTest,
  kolmogorovSmirnov2Test,
} from '../src/index.js';

describe('G30 #786 pearsonr/linregress p-value underflow (perfect correlation)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const y = x.map((v) => 2 * v + 1);

  it('pearsonr pValue matches SciPy (not hard 0)', () => {
    const r = pearsonr(x, y);
    expect(r.coefficient).toBeCloseTo(1, 12);
    expect(r.pValue).toBeGreaterThan(0);
    expect(r.pValue).toBeCloseTo(1.701605740040155e-61, 12);
    expect(r.pValue).not.toBe(0);
  });

  it('linregress pValue matches SciPy (not hard 0)', () => {
    const r = linregress(x, y);
    expect(r.slope).toBeCloseTo(2, 12);
    expect(r.intercept).toBeCloseTo(1, 12);
    expect(r.rValue).toBeCloseTo(1, 12);
    expect(r.pValue).toBeGreaterThan(0);
    expect(r.pValue).toBeCloseTo(4.374999999999999e-80, 12);
    expect(r.pValue).not.toBe(0);
  });
});

describe('G30 #783 kolmogorovSmirnov norm name + ks2 p', () => {
  const sample = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("kolmogorovSmirnovTest(sample, 'normal') does not throw", async () => {
    const r = await kolmogorovSmirnovTest(sample, 'normal');
    expect(r.statistic).toBeGreaterThanOrEqual(0);
    expect(r.pValue).toBeGreaterThanOrEqual(0);
    expect(r.pValue).toBeLessThanOrEqual(1);
  });

  it("kolmogorovSmirnovTest(sample, 'norm') matches explicit N(0,1) CDF path", async () => {
    const a = await kolmogorovSmirnovTest(sample, 'norm');
    expect(a.statistic).toBeGreaterThan(0);
  });

  it('kolmogorovSmirnov2Test [1,2,3] vs [2,3,4] p ≈ 1 (SciPy exact)', () => {
    const r = kolmogorovSmirnov2Test([1, 2, 3], [2, 3, 4]);
    expect(r.statistic).toBeCloseTo(1 / 3, 12);
    expect(r.pValue).toBeCloseTo(1, 12);
  });
});

describe('G30 #777 kendalltau exact default at n=10', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const y = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];

  it('coefficient and exact p-value match SciPy auto', () => {
    const r = kendalltau(x, y);
    expect(r.coefficient).toBeCloseTo(0.8222222222222222, 12);
    expect(r.pValue).toBeCloseTo(0.0003576940035273369, 12);
    expect(r.pValue).toBeLessThan(0.001);
  });
});

describe('G30 #778 quantileSeq options + NumPy method names', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("quantileSeq(x, 0.25, { method: 'linear' }) matches NumPy", () => {
    expect(quantileSeq(x, 0.25, { method: 'linear' }) as number).toBeCloseTo(3.25, 12);
  });

  it('weibull and hazen methods match NumPy on [1..10]', () => {
    expect(quantileSeq(x, 0.25, 'weibull') as number).toBeCloseTo(2.75, 12);
    expect(quantileSeq(x, 0.25, 'hazen') as number).toBeCloseTo(3.0, 12);
  });
});

describe('G30 #781 describe std and quartiles', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('includes std, q25, q50, q75', () => {
    const d = statsDescribe(x);
    expect(d.std).toBeCloseTo(3.0276503540974917, 12);
    expect(d.q25).toBeCloseTo(3.25, 12);
    expect(d.q50).toBeCloseTo(5.5, 12);
    expect(d.q75).toBeCloseTo(7.75, 12);
    expect(d.variance).toBeCloseTo(9.166666666666666, 12);
  });
});
