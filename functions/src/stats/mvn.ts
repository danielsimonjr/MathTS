/**
 * Multivariate-normal density (`mvnPdf`) and Cholesky-based sampling
 * (`mvnSample`) (Stats-breadth chunk).
 *
 * `mvnPdf` is a thin, dimension-flexible wrapper over the existing
 * `multivariateNormal` distribution object (`typed/dist-objects.ts`) — no
 * density math is duplicated. `mvnSample` reuses the existing public
 * `cholesky` factorization (`typed/matrix-ops.ts`, `Σ = LLᵀ`) and draws
 * `x = μ + L·z` for standard normal `z`, using the package's existing
 * seeded-RNG infrastructure (`probability/util/seededRNG.ts`) for
 * reproducibility.
 */
import { multivariateNormal } from '../typed/dist-objects.js';
import { cholesky } from '../typed/matrix-ops.js';
import { createRng } from '../probability/util/seededRNG.js';

/** A vector given either as a scalar (1-D case) or an array (k-D case). */
export type MvnVector = number | readonly number[];
/** A covariance given either as a scalar variance (1-D case) or a k×k matrix. */
export type MvnCov = number | readonly (readonly number[])[];

function normalizeMvnInputs(
  mean: MvnVector,
  cov: MvnCov
): { meanArr: number[]; covArr: number[][] } {
  if (typeof mean === 'number') {
    if (typeof cov !== 'number') {
      throw new Error('mvn: cov must be a scalar variance when mean is a scalar');
    }
    if (!(cov > 0)) throw new Error('mvn: variance must be positive');
    return { meanArr: [mean], covArr: [[cov]] };
  }

  if (typeof cov === 'number') {
    throw new Error('mvn: cov must be a k×k matrix when mean is a vector');
  }

  const meanArr = [...mean];
  const k = meanArr.length;
  const covArr = cov.map((row) => [...row]);
  if (covArr.length !== k || covArr.some((row) => row.length !== k)) {
    throw new Error(`mvn: cov must be ${k}x${k} matching mean length ${k}`);
  }
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const tol = 1e-9 * (1 + Math.abs(covArr[i][j]));
      if (Math.abs(covArr[i][j] - covArr[j][i]) > tol) {
        throw new Error('mvn: cov must be symmetric');
      }
    }
  }
  return { meanArr, covArr };
}

/**
 * Multivariate-normal probability density, handling both the 1-D case
 * (`x`/`mean` scalars, `cov` a scalar variance) and the general k-D case
 * (`x`/`mean` length-k arrays, `cov` a k×k matrix). Reduces to the ordinary
 * normal PDF when k=1.
 *
 * @example
 * mvnPdf([0, 0], [0, 0], [[1, 0], [0, 1]]); // ~0.15915494 (scipy multivariate_normal.pdf)
 * mvnPdf(0, 0, 1); // ~0.3989422804 (standard normal density at 0)
 */
export function mvnPdf(x: MvnVector, mean: MvnVector, cov: MvnCov): number {
  const { meanArr, covArr } = normalizeMvnInputs(mean, cov);
  const xArr = typeof x === 'number' ? [x] : [...x];
  if (xArr.length !== meanArr.length) {
    throw new Error(`mvnPdf: x must have length ${meanArr.length} (matching mean)`);
  }
  return multivariateNormal(meanArr, covArr).pdf(xArr);
}

/** Options for {@link mvnSample}. */
export interface MvnSampleOptions {
  /** Seed for the deterministic RNG (reproducible draws). Omit for a
   * time-seeded, non-reproducible generator. */
  seed?: string | number;
}

/**
 * Draw `n` samples from a multivariate normal `N(mean, cov)` via `x = mean +
 * L·z`, where `Σ = LLᵀ` (Cholesky) and `z` is a vector of independent standard
 * normals (Box-Muller). Handles the 1-D case the same as {@link mvnPdf}.
 * Returns an `n`-length array of length-k row vectors.
 *
 * @example
 * mvnSample([1, 2], [[2, 0.5], [0.5, 1]], 20000, { seed: 42 });
 * // empirical mean ~= [1, 2], empirical covariance ~= [[2, 0.5], [0.5, 1]]
 */
export function mvnSample(
  mean: MvnVector,
  cov: MvnCov,
  n: number,
  opts?: MvnSampleOptions
): number[][] {
  if (!Number.isInteger(n) || n < 1) throw new Error('mvnSample: n must be a positive integer');
  const { meanArr, covArr } = normalizeMvnInputs(mean, cov);
  const k = meanArr.length;
  const { L } = cholesky(covArr);
  const rng = createRng(opts?.seed ?? null);

  const samples: number[][] = new Array(n);
  for (let s = 0; s < n; s++) {
    const z = new Array<number>(k);
    for (let i = 0; i < k; i++) {
      const u1 = Math.max(rng(), 1e-300);
      const u2 = rng();
      z[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    const row = new Array<number>(k);
    for (let i = 0; i < k; i++) {
      let sum = meanArr[i];
      for (let j = 0; j <= i; j++) sum += L[i][j] * z[j];
      row[i] = sum;
    }
    samples[s] = row;
  }
  return samples;
}
