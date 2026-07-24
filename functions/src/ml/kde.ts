/**
 * 1-D Gaussian kernel density estimation (Wave — ML primitives, Phase 3 Task 5).
 *
 * The first nonparametric density estimator in the library. Given samples
 * `s_1..s_n`, estimates the density at query points via a sum of Gaussian
 * "bumps" centered on each sample:
 *
 *   density(x) = (1 / (n * h)) * sum_i phi((x - s_i) / h)
 *
 * where `phi` is the standard normal pdf and `h` is the bandwidth. Bandwidth
 * defaults to Silverman's rule of thumb, which balances bias (too smooth)
 * against variance (too noisy) using the sample spread.
 */

export interface GaussianKDEOptions {
  /** Bandwidth (smoothing parameter). Defaults to Silverman's rule of thumb. */
  bandwidth?: number;
}

export interface GaussianKDEResult {
  /** Evaluate the estimated density at each of `xs`. */
  evaluate: (xs: number[]) => number[];
  /** The bandwidth actually used (either supplied or Silverman's rule). */
  bandwidth: number;
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** Standard normal pdf, phi(z) = exp(-z^2/2) / sqrt(2*pi). */
function standardNormalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / SQRT_2PI;
}

/** Sample standard deviation (ddof = 1). */
function sampleStd(samples: number[], mean: number): number {
  const n = samples.length;
  let sumSq = 0;
  for (const s of samples) {
    const d = s - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (n - 1));
}

/** Linear-interpolated percentile (0-100) over a pre-sorted array. */
function percentileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Silverman's rule-of-thumb bandwidth: `h = 0.9 * min(sigma, IQR/1.34) * n^(-1/5)`.
 * Falls back to `0.9 * sigma * n^(-1/5)` when the IQR is 0 (heavily repeated
 * data), and throws when sigma is also 0 (a degenerate constant sample).
 */
function silvermanBandwidth(samples: number[]): number {
  const n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const sigma = sampleStd(samples, mean);
  const sorted = [...samples].sort((a, b) => a - b);
  const iqr = percentileSorted(sorted, 75) - percentileSorted(sorted, 25);
  const spread = iqr > 0 ? Math.min(sigma, iqr / 1.34) : sigma;
  if (spread === 0) {
    throw new Error(
      'gaussianKDE: cannot derive a Silverman bandwidth from a constant sample ' +
        '(standard deviation and IQR are both 0); pass an explicit `bandwidth`.'
    );
  }
  return 0.9 * spread * Math.pow(n, -1 / 5);
}

/**
 * 1-D Gaussian kernel density estimation.
 *
 * @param samples - Observed sample values (n >= 2 for the default bandwidth;
 *   a single sample requires an explicit `opts.bandwidth`)
 * @param opts - `bandwidth` (default: Silverman's rule of thumb)
 * @returns `evaluate(xs)` — density at each query point — and the chosen `bandwidth`
 *
 * @example
 * const kde = gaussianKDE([-1, 0, 0, 1]);
 * kde.evaluate([0]); // => density near the sample center (a single peak)
 */
export function gaussianKDE(samples: number[], opts: GaussianKDEOptions = {}): GaussianKDEResult {
  if (samples.length === 0) {
    throw new Error('gaussianKDE: `samples` must be non-empty.');
  }
  const bandwidth = opts.bandwidth ?? silvermanBandwidth(samples);
  if (!(bandwidth > 0)) {
    throw new Error('gaussianKDE: `bandwidth` must be a positive number.');
  }
  const n = samples.length;

  const evaluate = (xs: number[]): number[] =>
    xs.map((x) => {
      let sum = 0;
      for (const s of samples) {
        sum += standardNormalPdf((x - s) / bandwidth);
      }
      return sum / (n * bandwidth);
    });

  return { evaluate, bandwidth };
}
