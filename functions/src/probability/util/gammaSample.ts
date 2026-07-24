/**
 * Shared RNG-driven Gamma / standard-normal variate generators.
 *
 * Extracted so the distribution objects (`typed/dist-objects.ts`) and the
 * multivariate samplers (`stats/multivariate-sampling.ts`) share ONE
 * Marsaglia & Tsang gamma implementation rather than each carrying a copy.
 */

/**
 * Standard normal N(0,1) variate via Box-Muller, driven by a caller-supplied
 * uniform PRNG (so seeded draws are reproducible). Guards `log(0)`.
 */
export function normalSampleRng(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Gamma(alpha, 1) variate (shape `alpha`, unit scale) via Marsaglia & Tsang's
 * method, driven by a caller-supplied uniform PRNG. For `alpha < 1` it uses the
 * boosting identity `Gamma(a) = Gamma(a+1)·U^(1/a)`.
 */
export function gammaSampleRng(alpha: number, rng: () => number): number {
  if (alpha < 1) {
    return gammaSampleRng(alpha + 1, rng) * Math.pow(rng(), 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normalSampleRng(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
