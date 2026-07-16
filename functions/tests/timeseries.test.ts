import { describe, it, expect } from 'vitest';
import { pacf, ljungBox, durbinWatson, adfuller } from '../src/index.js';

describe('time-series inference', () => {
  it('durbinWatson exact for a short alternating-residual series (verified vs statsmodels.stats.stattools.durbin_watson)', () => {
    // statsmodels: durbin_watson([1,-1,1,-1,1,-1]) == 3.3333333333333335
    // (== 4*(n-1)/n for a perfectly-alternating series of length n; only
    // approaches the textbook "~4" bound as n -> infinity, not at n=6).
    expect(durbinWatson([1, -1, 1, -1, 1, -1])).toBeCloseTo(10 / 3, 8);
  });
  it('durbinWatson in (1,3.5) for a low-autocorrelation series', () => {
    const dw = durbinWatson([0.5, -0.3, 0.2, -0.4, 0.6, -0.1, 0.3, -0.5]);
    expect(dw).toBeGreaterThan(1);
    expect(dw).toBeLessThan(3.5);
  });
  it('pacf[0]=1 and length nlags+1', () => {
    const p = pacf([1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2], 3);
    expect(p[0]).toBeCloseTo(1, 8);
    expect(p).toHaveLength(4);
  });
  it('pacf matches statsmodels.tsa.stattools.pacf(method="ldb")', () => {
    // statsmodels: pacf([1,2,3,2,1,2,3,2,1,2,3,2], nlags=3, method='ldb')
    // == [1, 0, -0.8333333333333335, 0]
    const p = pacf([1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2], 3);
    expect(p[1]).toBeCloseTo(0, 8);
    expect(p[2]).toBeCloseTo(-0.8333333333333335, 8);
    expect(p[3]).toBeCloseTo(0, 8);
  });
  it('ljungBox returns statistic>0 and pValue in [0,1]', () => {
    const r = ljungBox([1, 2, 1, 2, 1, 2, 1, 2, 1, 2], 3);
    expect(r.statistic).toBeGreaterThan(0);
    expect(r.pValue).toBeGreaterThanOrEqual(0);
    expect(r.pValue).toBeLessThanOrEqual(1);
  });
  it('ljungBox statistic matches statsmodels.stats.diagnostic.acorr_ljungbox', () => {
    // statsmodels: acorr_ljungbox([1,2,1,2,1,2,1,2,1,2], lags=[3]) -> lb_stat = 28.8
    const r = ljungBox([1, 2, 1, 2, 1, 2, 1, 2, 1, 2], 3);
    expect(r.statistic).toBeCloseTo(28.8, 6);
  });
  it('adfuller returns finite statistic and pValue in [0,1]', () => {
    const x = Array.from({ length: 60 }, (_, i) => Math.sin(i / 3) + (i % 3) * 0.1);
    const r = adfuller(x);
    expect(Number.isFinite(r.statistic)).toBe(true);
    expect(r.pValue).toBeGreaterThanOrEqual(0);
    expect(r.pValue).toBeLessThanOrEqual(1);
    expect(r.usedLag).toBeGreaterThanOrEqual(0);
  });
  it('adfuller rejects a unit root less often for a trending random walk than for stationary noise', () => {
    // A crude sanity oracle: white noise should have a much more negative
    // (more stationary-looking) ADF statistic than a cumulative sum (random walk).
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const noise = Array.from({ length: 80 }, () => rand() - 0.5);
    const walk: number[] = [];
    let acc = 0;
    for (let i = 0; i < 80; i++) {
      acc += rand() - 0.5;
      walk.push(acc);
    }
    const rNoise = adfuller(noise);
    const rWalk = adfuller(walk);
    expect(rNoise.statistic).toBeLessThan(rWalk.statistic);
  });
});
