import { describe, it, expect } from 'vitest';
import { gaussianProcessRegression, gpRegression } from '../src/index.js';

/**
 * Gaussian-process regression, oracle-pinned against
 * sklearn.gaussian_process.GaussianProcessRegressor with the matching
 * ConstantKernel(σ_f²)·RBF(ℓ) / ·Matern(ℓ, ν) kernel, alpha=noise,
 * optimizer=None, normalize_y=False. Every expected value below is an EXTERNAL
 * oracle (scikit-learn 1.x), not a self-referential round trip.
 *
 * Training corpus (1-D):
 *   X = [[-4],[-3],[-1],[0],[2]],  y = [-2, 0, 1, 2, -1]
 * Hyperparameters: σ_f² = 1.5, ℓ = 1.2, α = 1e-2.
 * Test points: [-4, -2, -0.5, 1, 3.5, 10].
 */
const X = [[-4], [-3], [-1], [0], [2]];
const y = [-2, 0, 1, 2, -1];
const Xstar = [[-4], [-2], [-0.5], [1], [3.5], [10]];
const sf2 = 1.5;
const ell = 1.2;
const noise = 1e-2;

describe('gaussianProcessRegression — RBF kernel vs sklearn', () => {
  const gp = gaussianProcessRegression(X, y, {
    kernel: 'rbf',
    lengthScale: ell,
    signalVariance: sf2,
    noise,
  });
  const pred = gp.predict(Xstar);

  // sklearn GaussianProcessRegressor(ConstantKernel(1.5)*RBF(1.2), alpha=1e-2)
  const meanOracle = [
    -1.971181766540328, 0.656814816795589, 1.587190778225098, 0.914588424450243, -0.806498819002026,
    -0.000000000420208,
  ];
  const stdOracle = [
    0.099305938016539, 0.379339534522698, 0.145272783585503, 0.456579965038883, 1.078068433710757,
    1.224744871391589,
  ];

  it('posterior mean matches sklearn to ~1e-6', () => {
    pred.mean.forEach((m, i) => expect(m).toBeCloseTo(meanOracle[i], 6));
  });
  it('posterior std matches sklearn to ~1e-5', () => {
    pred.std.forEach((s, i) => expect(s).toBeCloseTo(stdOracle[i], 5));
  });
  it('variance equals std squared', () => {
    pred.variance.forEach((v, i) => expect(v).toBeCloseTo(pred.std[i] * pred.std[i], 12));
  });
});

describe('gaussianProcessRegression — Matérn 3/2 vs sklearn', () => {
  const pred = gaussianProcessRegression(X, y, {
    kernel: 'matern32',
    lengthScale: ell,
    signalVariance: sf2,
    noise,
  }).predict(Xstar);
  const meanOracle = [
    -1.980460853131804, 0.527630520997577, 1.609790006135102, 0.506209693568459, -0.455389954297718,
    -0.000163117690188,
  ];
  const stdOracle = [
    0.099503268323016, 0.80582461096662, 0.414407120251295, 0.816183278841993, 1.140550108903792,
    1.224744862228717,
  ];
  it('mean matches sklearn Matern(nu=1.5) to ~1e-6', () => {
    pred.mean.forEach((m, i) => expect(m).toBeCloseTo(meanOracle[i], 6));
  });
  it('std matches sklearn Matern(nu=1.5) to ~1e-5', () => {
    pred.std.forEach((s, i) => expect(s).toBeCloseTo(stdOracle[i], 5));
  });
});

describe('gaussianProcessRegression — Matérn 5/2 vs sklearn', () => {
  const pred = gaussianProcessRegression(X, y, {
    kernel: 'matern52',
    lengthScale: ell,
    signalVariance: sf2,
    noise,
  }).predict(Xstar);
  const meanOracle = [
    -1.97845201613701, 0.585474908183172, 1.628666561468286, 0.596042059971518, -0.531104864371343,
    -0.000044578893812,
  ];
  const stdOracle = [
    0.099454778673248, 0.693507102798052, 0.296997938683896, 0.717512940005396, 1.125371127095611,
    1.224744870812377,
  ];
  it('mean matches sklearn Matern(nu=2.5) to ~1e-6', () => {
    pred.mean.forEach((m, i) => expect(m).toBeCloseTo(meanOracle[i], 6));
  });
  it('std matches sklearn Matern(nu=2.5) to ~1e-5', () => {
    pred.std.forEach((s, i) => expect(s).toBeCloseTo(stdOracle[i], 5));
  });
});

describe('gaussianProcessRegression — implementation-independent limits', () => {
  it('noiseless GP interpolates training targets (mean → y, variance → 0)', () => {
    const gp = gaussianProcessRegression(X, y, {
      kernel: 'rbf',
      lengthScale: ell,
      signalVariance: sf2,
      noise: 1e-10,
    });
    const pred = gp.predict(X);
    pred.mean.forEach((m, i) => expect(m).toBeCloseTo(y[i], 6));
    // variance at a training point ≈ the jitter noise (→ 0).
    pred.variance.forEach((v) => expect(v).toBeLessThan(1e-8));
  });

  it('far from data the posterior returns to the prior (mean → 0, var → σ_f²)', () => {
    const gp = gaussianProcessRegression(X, y, {
      kernel: 'rbf',
      lengthScale: ell,
      signalVariance: sf2,
      noise,
    });
    const pred = gp.predict([[1000]]);
    expect(pred.mean[0]).toBeCloseTo(0, 6);
    expect(pred.variance[0]).toBeCloseTo(sf2, 6);
  });

  it('log marginal likelihood is finite and gpRegression aliases the fitter', () => {
    const gp = gpRegression(X, y, { lengthScale: ell, signalVariance: sf2, noise });
    expect(Number.isFinite(gp.logMarginalLikelihood)).toBe(true);
    expect(gp.kernel).toBe('rbf');
  });
});

describe('gaussianProcessRegression — input validation', () => {
  it('rejects mismatched X/y lengths', () => {
    expect(() => gaussianProcessRegression([[0], [1]], [1])).toThrow(/must match/);
  });
  it('rejects a non-positive length scale', () => {
    expect(() => gaussianProcessRegression(X, y, { lengthScale: 0 })).toThrow(/lengthScale/);
  });
  it('rejects negative noise', () => {
    expect(() => gaussianProcessRegression(X, y, { noise: -1 })).toThrow(/noise/);
  });
});
