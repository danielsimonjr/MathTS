/**
 * Gaussian-process regression (`gaussianProcessRegression` / `gpRegression`)
 * (Stats-breadth chunk).
 *
 * Fits a zero-mean GP prior with an RBF (squared-exponential) or Matérn 3/2 /
 * 5/2 covariance kernel to training data `(X, y)` under i.i.d. Gaussian noise
 * `α`, and predicts the posterior **mean and variance** at new points. Uses the
 * standard Rasmussen & Williams (Algorithm 2.1) Cholesky solve:
 *
 *   K = k(X,X) + αI ,   L = chol(K) ,   ᾱ = Lᵀ \ (L \ y)
 *   mean(x*) = k(x*,X)·ᾱ
 *   var(x*)  = k(x*,x*) − vᵀv ,   v = L \ k(X,x*)
 *
 * The Cholesky factorization routes to the maintained, oracle-pinned
 * matrix-package primitive via `cholesky` (`typed/matrix-ops.ts`); the
 * triangular solves are done here (small, forward/back substitution).
 *
 * Oracle-pinned against `sklearn.gaussian_process.GaussianProcessRegressor`
 * with a matching `ConstantKernel(σ_f²)·RBF(ℓ)` (or `Matern`) kernel and
 * `alpha=α`.
 */
import { cholesky } from '../typed/matrix-ops.js';

/** Supported covariance kernels. */
export type GPKernel = 'rbf' | 'matern32' | 'matern52';

/** Options for {@link gaussianProcessRegression}. */
export interface GPOptions {
  /** Covariance kernel. Default `'rbf'` (squared-exponential). */
  kernel?: GPKernel;
  /** Kernel length-scale ℓ (> 0). Default `1`. */
  lengthScale?: number;
  /** Signal variance σ_f² (kernel amplitude, > 0). Default `1`. */
  signalVariance?: number;
  /** I.i.d. Gaussian noise variance α added to the diagonal (≥ 0). Default `1e-10`. */
  noise?: number;
}

/** Posterior prediction at a set of test points. */
export interface GPPrediction {
  /** Posterior mean at each test point. */
  mean: number[];
  /** Posterior variance at each test point (≥ 0). */
  variance: number[];
  /** Posterior standard deviation at each test point (= √variance). */
  std: number[];
}

/** A fitted Gaussian-process regressor. */
export interface GPModel {
  /** Predict the posterior mean/variance/std at the given test points. */
  predict(Xstar: readonly (readonly number[])[]): GPPrediction;
  /** Log marginal likelihood log p(y | X) of the training data under the prior. */
  logMarginalLikelihood: number;
  /** The resolved kernel name. */
  kernel: GPKernel;
}

const SQRT3 = Math.sqrt(3);
const SQRT5 = Math.sqrt(5);

/** Euclidean distance between two feature vectors. */
function euclidean(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Build the kernel function k(a,b) for the chosen family (amplitude σ_f²). */
function makeKernel(
  kernel: GPKernel,
  ell: number,
  sf2: number
): (a: readonly number[], b: readonly number[]) => number {
  switch (kernel) {
    case 'rbf':
      return (a, b) => {
        const r = euclidean(a, b);
        return sf2 * Math.exp(-(r * r) / (2 * ell * ell));
      };
    case 'matern32':
      return (a, b) => {
        const u = (SQRT3 * euclidean(a, b)) / ell;
        return sf2 * (1 + u) * Math.exp(-u);
      };
    case 'matern52':
      return (a, b) => {
        const r = euclidean(a, b);
        const u = (SQRT5 * r) / ell;
        return sf2 * (1 + u + (5 * r * r) / (3 * ell * ell)) * Math.exp(-u);
      };
    default:
      throw new Error(`gaussianProcessRegression: unknown kernel '${String(kernel)}'`);
  }
}

/** Forward substitution: solve L·x = b for lower-triangular L. */
function forwardSolve(L: number[][], b: readonly number[]): number[] {
  const n = b.length;
  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let j = 0; j < i; j++) s -= L[i][j] * x[j];
    x[i] = s / L[i][i];
  }
  return x;
}

/** Back substitution: solve Lᵀ·x = b for lower-triangular L. */
function backSolveTranspose(L: number[][], b: readonly number[]): number[] {
  const n = b.length;
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= L[j][i] * x[j];
    x[i] = s / L[i][i];
  }
  return x;
}

function normalizeTrainingInputs(
  X: readonly (readonly number[])[],
  y: readonly number[]
): { Xa: number[][]; ya: number[]; dim: number } {
  if (!Array.isArray(X) || X.length === 0) {
    throw new Error('gaussianProcessRegression: X must be a non-empty array of feature vectors');
  }
  if (y.length !== X.length) {
    throw new Error(
      `gaussianProcessRegression: y length ${y.length} must match number of rows ${X.length}`
    );
  }
  const dim = X[0].length;
  if (dim === 0) throw new Error('gaussianProcessRegression: feature vectors must be non-empty');
  const Xa = X.map((row) => {
    if (row.length !== dim) {
      throw new Error('gaussianProcessRegression: all feature vectors must have the same length');
    }
    return [...row];
  });
  return { Xa, ya: [...y], dim };
}

/**
 * Fit a Gaussian-process regressor to training points `X` (array of
 * length-d feature vectors) and targets `y`, then return a model exposing
 * `.predict(Xstar)` (posterior mean/variance/std) and the log marginal
 * likelihood.
 *
 * @example
 * const gp = gaussianProcessRegression(
 *   [[-4], [-3], [-1], [0], [2]],
 *   [-2, 0, 1, 2, -1],
 *   { kernel: 'rbf', lengthScale: 1.2, signalVariance: 1.5, noise: 1e-2 }
 * );
 * gp.predict([[-0.5], [10]]); // mean ≈ [1.5872, ~0], std ≈ [0.1453, 1.2247]
 */
export function gaussianProcessRegression(
  X: readonly (readonly number[])[],
  y: readonly number[],
  options: GPOptions = {}
): GPModel {
  const kernel = options.kernel ?? 'rbf';
  const ell = options.lengthScale ?? 1;
  const sf2 = options.signalVariance ?? 1;
  const noise = options.noise ?? 1e-10;
  if (!(ell > 0)) throw new Error('gaussianProcessRegression: lengthScale must be positive');
  if (!(sf2 > 0)) throw new Error('gaussianProcessRegression: signalVariance must be positive');
  if (!(noise >= 0)) throw new Error('gaussianProcessRegression: noise must be non-negative');

  const { Xa, ya } = normalizeTrainingInputs(X, y);
  const n = Xa.length;
  const k = makeKernel(kernel, ell, sf2);

  // K = k(X,X) + noise·I
  const K = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const kij = k(Xa[i], Xa[j]);
      K[i][j] = kij;
      K[j][i] = kij;
    }
    K[i][i] += noise;
  }

  // L = chol(K); ᾱ = Lᵀ \ (L \ y)
  const { L } = cholesky(K);
  const Linvy = forwardSolve(L, ya);
  const alphaBar = backSolveTranspose(L, Linvy);

  // log marginal likelihood = −½ yᵀᾱ − Σ log L_ii − n/2 log(2π)
  let logDetHalf = 0;
  for (let i = 0; i < n; i++) logDetHalf += Math.log(L[i][i]);
  let yTa = 0;
  for (let i = 0; i < n; i++) yTa += ya[i] * alphaBar[i];
  const logMarginalLikelihood = -0.5 * yTa - logDetHalf - (n / 2) * Math.log(2 * Math.PI);

  return {
    kernel,
    logMarginalLikelihood,
    predict(Xstar: readonly (readonly number[])[]): GPPrediction {
      const m = Xstar.length;
      const mean = new Array<number>(m);
      const variance = new Array<number>(m);
      const std = new Array<number>(m);
      for (let t = 0; t < m; t++) {
        const xt = Xstar[t];
        if (xt.length !== Xa[0].length) {
          throw new Error('gaussianProcessRegression.predict: test point dimensionality mismatch');
        }
        // ks = k(X, x*)
        const ks = new Array<number>(n);
        for (let i = 0; i < n; i++) ks[i] = k(Xa[i], xt);
        // mean = ksᵀ ᾱ
        let mu = 0;
        for (let i = 0; i < n; i++) mu += ks[i] * alphaBar[i];
        // v = L \ ks ; var = k(x*,x*) − vᵀv
        const v = forwardSolve(L, ks);
        let vtv = 0;
        for (let i = 0; i < n; i++) vtv += v[i] * v[i];
        const kss = k(xt, xt);
        const varT = Math.max(kss - vtv, 0);
        mean[t] = mu;
        variance[t] = varT;
        std[t] = Math.sqrt(varT);
      }
      return { mean, variance, std };
    },
  };
}

/** Alias of {@link gaussianProcessRegression}. */
export const gpRegression = gaussianProcessRegression;
