import { describe, it, expect } from 'vitest';
import {
  noncentralChi2CDF,
  noncentralFCDF,
  noncentralTCDF,
  circmean,
  circvar,
  vonMisesPDF,
  mcnemar,
  cochranQ,
} from '../src/index.js';
import { chiSquaredCDF, fCDF } from '../src/distribution-functions.js';

describe('noncentral / circular / paired-categorical', () => {
  it('noncentralChi2CDF(10,3,2) = 0.89856 (scipy)', () => {
    expect(noncentralChi2CDF(10, 3, 2)).toBeCloseTo(0.8985649635, 4);
  });
  it('noncentralFCDF(2,3,10,4) = 0.46636 (scipy)', () => {
    expect(noncentralFCDF(2, 3, 10, 4)).toBeCloseTo(0.466364216, 3);
  });

  it('noncentral chi2/F CDF at x<=0 is 0', () => {
    expect(noncentralChi2CDF(0, 3, 2)).toBe(0);
    expect(noncentralChi2CDF(-1, 3, 2)).toBe(0);
    expect(noncentralFCDF(0, 3, 10, 4)).toBe(0);
  });

  it('nc=0 matches central chi-square and F CDFs', () => {
    expect(noncentralChi2CDF(10, 3, 0)).toBeCloseTo(chiSquaredCDF(10, 3), 10);
    expect(noncentralFCDF(2, 3, 10, 0)).toBeCloseTo(fCDF(2, 3, 10), 10);
  });

  it('noncentral CDF validation messages unchanged', () => {
    expect(() => noncentralChi2CDF(1, 0, 1)).toThrow('noncentralChi2CDF: df must be positive');
    expect(() => noncentralChi2CDF(1, 1, -0.1)).toThrow(
      'noncentralChi2CDF: nc must be non-negative'
    );
    expect(() => noncentralFCDF(1, 0, 10, 1)).toThrow(
      'noncentralFCDF: dfn and dfd must be positive'
    );
    expect(() => noncentralFCDF(1, 3, 10, -1)).toThrow('noncentralFCDF: nc must be non-negative');
  });

  it('NaN x yields NaN noncentral chi2 CDF', () => {
    expect(Number.isNaN(noncentralChi2CDF(NaN, 3, 2))).toBe(true);
  });

  it('large nc still yields finite probability in [0,1]', () => {
    const p = noncentralChi2CDF(50, 5, 200);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
    expect(Number.isFinite(p)).toBe(true);
  });
  it('noncentralTCDF(1.5,10,2) = 0.30479 (scipy)', () => {
    expect(noncentralTCDF(1.5, 10, 2)).toBeCloseTo(0.3047854474, 3);
  });
  it('vonMisesPDF(0,0,2) = 0.51589 (scipy)', () => {
    expect(vonMisesPDF(0, 0, 2)).toBeCloseTo(0.515885412, 5);
  });
  it('circmean([0.1,0.2,6.2]) = 0.07236 (scipy, wraps near 0)', () => {
    expect(circmean([0.1, 0.2, 6.2])).toBeCloseTo(0.0723638036, 5);
  });
  it('circvar in [0,1]', () => {
    expect(circvar([0.1, 0.2, 0.15])).toBeGreaterThanOrEqual(0);
    expect(circvar([0, Math.PI, 2, 4])).toBeLessThanOrEqual(1);
  });
  it('mcnemar([[10,5],[3,12]], no correction) chi2=0.5', () => {
    const r = mcnemar(
      [
        [10, 5],
        [3, 12],
      ],
      { correction: false }
    );
    expect(r.chi2).toBeCloseTo(0.5, 6);
    expect(r.pValue).toBeGreaterThan(0);
  });
  it('cochranQ returns Q, dof=k-1, pValue in [0,1]', () => {
    const r = cochranQ([
      [1, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
      [1, 1, 0],
    ]);
    expect(r.dof).toBe(2);
    expect(r.Q).toBeGreaterThanOrEqual(0);
    expect(r.pValue).toBeGreaterThanOrEqual(0);
    expect(r.pValue).toBeLessThanOrEqual(1);
  });
});
