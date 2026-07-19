/**
 * Multivariate sampling beyond MVN: Dirichlet (`dirichletSample` /
 * `dirichletPdf`) and Wishart (`wishartSample`) (Stats-breadth chunk).
 *
 * - **Dirichlet** draws use the Gamma-normalization method: `gᵢ ~ Gamma(αᵢ,1)`,
 *   then `xᵢ = gᵢ / Σⱼ gⱼ`, reusing the shared Marsaglia & Tsang gamma sampler
 *   (`probability/util/gammaSample.ts`) already backing the distribution
 *   objects. `dirichletPdf` uses the closed-form density with `lgammaNumber`.
 * - **Wishart** draws use the Bartlett decomposition: `W = (L·A)(L·A)ᵀ` where
 *   `L = chol(scale)` and `A` is lower-triangular with `√χ²(df−i)` on the
 *   diagonal (0-indexed) and N(0,1) below.
 *
 * All samplers accept a `seed` for reproducible draws via the package's seeded
 * RNG (`probability/util/seededRNG.ts`), matching {@link mvnSample}. Being
 * random, they are oracle-pinned by implementation-independent statistical
 * invariants (simplex/SPD membership, moment convergence), while
 * `dirichletPdf` is pinned exactly against `scipy.stats.dirichlet.pdf`.
 */
import { cholesky } from '../typed/matrix-ops.js';
import { createRng } from '../probability/util/seededRNG.js';
import { gammaSampleRng, normalSampleRng } from '../probability/util/gammaSample.js';
import { lgammaNumber } from '../plain/number/probability.js';

/** Options for the multivariate samplers (shared shape with mvnSample). */
export interface SampleSeedOptions {
  /** Seed for the deterministic RNG (reproducible draws). Omit for a
   * time-seeded, non-reproducible generator. */
  seed?: string | number;
}

function validateAlpha(alpha: readonly number[], fn: string): void {
  if (!Array.isArray(alpha) || alpha.length < 2) {
    throw new Error(`${fn}: alpha must be an array of at least 2 concentration parameters`);
  }
  for (const a of alpha) {
    if (!(a > 0) || !Number.isFinite(a)) {
      throw new Error(`${fn}: all concentration parameters must be positive and finite`);
    }
  }
}

/**
 * Draw `n` samples from a Dirichlet(`alpha`) distribution via the
 * Gamma-normalization method. Each sample is a length-k vector on the simplex
 * (non-negative, summing to 1). Returns an `n`-length array of length-k vectors.
 *
 * @example
 * dirichletSample([2, 3, 5], 10000, { seed: 42 });
 * // empirical mean ≈ [0.2, 0.3, 0.5] = αᵢ / Σα
 */
export function dirichletSample(
  alpha: readonly number[],
  n = 1,
  opts?: SampleSeedOptions
): number[][] {
  validateAlpha(alpha, 'dirichletSample');
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('dirichletSample: n must be a positive integer');
  }
  const k = alpha.length;
  const rng = createRng(opts?.seed ?? null);
  const samples: number[][] = new Array(n);
  for (let s = 0; s < n; s++) {
    const g = new Array<number>(k);
    let total = 0;
    for (let i = 0; i < k; i++) {
      const gi = gammaSampleRng(alpha[i], rng);
      g[i] = gi;
      total += gi;
    }
    const row = new Array<number>(k);
    for (let i = 0; i < k; i++) row[i] = g[i] / total;
    samples[s] = row;
  }
  return samples;
}

/**
 * Dirichlet(`alpha`) probability density at a point `x` on the simplex.
 * `pdf(x) = (1 / B(α)) · Πᵢ xᵢ^(αᵢ−1)` with
 * `B(α) = Πᵢ Γ(αᵢ) / Γ(Σαᵢ)`. Matches `scipy.stats.dirichlet.pdf`.
 *
 * @example
 * dirichletPdf([0.2, 0.3, 0.5], [2, 3, 4]); // 7.56
 */
export function dirichletPdf(x: readonly number[], alpha: readonly number[]): number {
  validateAlpha(alpha, 'dirichletPdf');
  if (x.length !== alpha.length) {
    throw new Error(`dirichletPdf: x length ${x.length} must match alpha length ${alpha.length}`);
  }
  let sum = 0;
  for (const xi of x) {
    if (!(xi >= 0) || !(xi <= 1)) {
      throw new Error('dirichletPdf: x must lie on the simplex (each component in [0, 1])');
    }
    sum += xi;
  }
  if (Math.abs(sum - 1) > 1e-8) {
    throw new Error('dirichletPdf: x components must sum to 1');
  }
  // log B(α) = Σ lnΓ(αᵢ) − lnΓ(Σαᵢ)
  let a0 = 0;
  let logB = 0;
  for (const a of alpha) {
    logB += lgammaNumber(a);
    a0 += a;
  }
  logB -= lgammaNumber(a0);
  // log pdf = Σ (αᵢ−1) ln xᵢ − log B(α)
  let logpdf = -logB;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const p = alpha[i] - 1;
    if (p !== 0) {
      // 0^0 → 1 (contributes 0); a boundary xᵢ=0 with αᵢ>1 → density 0.
      logpdf += p * Math.log(xi);
    }
  }
  return Math.exp(logpdf);
}

function validateScale(scale: readonly (readonly number[])[], fn: string): number {
  if (!Array.isArray(scale) || scale.length === 0) {
    throw new Error(`${fn}: scale must be a non-empty square matrix`);
  }
  const p = scale.length;
  for (const row of scale) {
    if (row.length !== p) throw new Error(`${fn}: scale must be a ${p}x${p} square matrix`);
  }
  for (let i = 0; i < p; i++) {
    for (let j = i + 1; j < p; j++) {
      const tol = 1e-9 * (1 + Math.abs(scale[i][j]));
      if (Math.abs(scale[i][j] - scale[j][i]) > tol) {
        throw new Error(`${fn}: scale must be symmetric`);
      }
    }
  }
  return p;
}

/**
 * Draw `n` samples from a Wishart(`df`, `scale`) distribution via the Bartlett
 * decomposition: with `L = chol(scale)` and a lower-triangular `A` whose
 * diagonal entries are `√χ²(df−i)` (0-indexed) and whose strictly-lower entries
 * are N(0,1), each sample is `W = (L·A)(L·A)ᵀ` — a `p×p` symmetric
 * positive-definite matrix. Returns an `n`-length array of `p×p` matrices.
 *
 * `df` must exceed `p − 1` (so every χ² degree-of-freedom is positive). The
 * mean of the distribution is `df · scale`.
 *
 * @example
 * wishartSample(6, [[2, 0.5], [0.5, 1]], 10000, { seed: 7 });
 * // empirical mean ≈ [[12, 3], [3, 6]] = df · scale
 */
export function wishartSample(
  df: number,
  scale: readonly (readonly number[])[],
  n = 1,
  opts?: SampleSeedOptions
): number[][][] {
  const p = validateScale(scale, 'wishartSample');
  if (!(df > p - 1)) {
    throw new Error(`wishartSample: df must be greater than p−1 = ${p - 1}`);
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('wishartSample: n must be a positive integer');
  }
  const { L } = cholesky(scale.map((row) => [...row]));
  const rng = createRng(opts?.seed ?? null);
  const samples: number[][][] = new Array(n);

  for (let s = 0; s < n; s++) {
    // Bartlett A: lower-triangular; diag = √χ²(df−i) = √(2·Gamma((df−i)/2, 1)).
    const A = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    for (let i = 0; i < p; i++) {
      A[i][i] = Math.sqrt(2 * gammaSampleRng((df - i) / 2, rng));
      for (let j = 0; j < i; j++) A[i][j] = normalSampleRng(rng);
    }
    // M = L · A (lower-triangular · lower-triangular)
    const M = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    for (let i = 0; i < p; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let m = j; m <= i; m++) sum += L[i][m] * A[m][j];
        M[i][j] = sum;
      }
    }
    // W = M · Mᵀ (symmetric)
    const W = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    for (let i = 0; i < p; i++) {
      for (let j = i; j < p; j++) {
        let sum = 0;
        const lim = Math.min(i, j);
        for (let m = 0; m <= lim; m++) sum += M[i][m] * M[j][m];
        W[i][j] = sum;
        W[j][i] = sum;
      }
    }
    samples[s] = W;
  }
  return samples;
}
