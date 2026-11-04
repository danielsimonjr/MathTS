/**
 * Global, derivative-free optimizers.
 *
 * - {@link differentialEvolution}: Storn & Price DE with the `rand/1/bin`
 *   mutation/crossover scheme (defaults `F = 0.8`, `CR = 0.9`,
 *   population `15 · dim`). Population members are kept inside `bounds`.
 * - {@link simulatedAnnealing}: Metropolis random walk with a geometric
 *   cooling schedule. Proposal width shrinks with the temperature.
 *
 * Both use a seeded `seedrandom` generator (`createRng`), so the same seed
 * gives an identical result. Non-finite objective values are treated as
 * `+Infinity`.
 *
 * @packageDocumentation
 */
import { createRng } from '../probability/util/seededRNG.js';

/** Options shared by the global optimizers. */
export interface GlobalOptimizeOptions {
  /** Seed for the deterministic RNG (default `0`). */
  seed?: number;
  /** Maximum number of generations / iterations (default 1000 for DE, 10000 for SA). */
  maxIter?: number;
  /** Differential-evolution population size (default `15 · dim`). */
  popSize?: number;
  /** Convergence tolerance (DE: population fitness spread; SA: final temperature). */
  tol?: number;
  /** Differential weight `F` (default 0.8). */
  F?: number;
  /** Crossover probability `CR` (default 0.9). */
  CR?: number;
}

/** Result of the global optimizers. */
export interface GlobalOptimizeResult {
  /** Best point found. */
  x: number[];
  /** Objective value at `x`. */
  fx: number;
  /** Generations (DE) or iterations (SA) performed. */
  iterations: number;
  /** Number of objective evaluations. */
  evaluations: number;
  /** Whether the convergence test was met before the iteration budget ran out. */
  converged: boolean;
}

/** Options for {@link simulatedAnnealing}. */
export interface SimulatedAnnealingOptions extends GlobalOptimizeOptions {
  /** Initial temperature (default 1). */
  T0?: number;
  /** Geometric cooling factor applied per iteration, in (0, 1) (default 0.995). */
  cooling?: number;
  /** Optional box `[lo, hi]` per coordinate; proposals are clipped into it. */
  bounds?: ReadonlyArray<readonly [number, number]>;
}

type Bounds = ReadonlyArray<readonly [number, number]>;

function validateBounds(bounds: Bounds): void {
  if (bounds.length === 0) {
    throw new RangeError('bounds must contain at least one [lo, hi] pair');
  }
  for (const [lo, hi] of bounds) {
    if (!(lo < hi)) {
      throw new RangeError(`invalid bound [${lo}, ${hi}]: lo must be < hi`);
    }
  }
}

function safeEval(f: (x: number[]) => number, x: number[]): number {
  const v = f(x);
  return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
}

/**
 * Minimize `f` over the box `bounds` with differential evolution (`rand/1/bin`).
 *
 * @example
 * differentialEvolution((x) => x[0] ** 2 + x[1] ** 2, [[-5, 5], [-5, 5]], { seed: 1 }).fx
 * // ~0
 */
export function differentialEvolution(
  f: (x: number[]) => number,
  bounds: ReadonlyArray<readonly [number, number]>,
  opts: GlobalOptimizeOptions = {}
): GlobalOptimizeResult {
  validateBounds(bounds);
  const dim = bounds.length;
  const maxIter = opts.maxIter ?? 1000;
  const tol = opts.tol ?? 1e-12;
  const F = opts.F ?? 0.8;
  const CR = opts.CR ?? 0.9;
  const np = Math.max(4, opts.popSize ?? 15 * dim);
  const rng = createRng(opts.seed ?? 0);

  let evaluations = 0;
  const evalAt = (x: number[]): number => {
    evaluations++;
    return safeEval(f, x);
  };

  const pop: number[][] = [];
  const fit: number[] = [];
  for (let i = 0; i < np; i++) {
    const x = bounds.map(([lo, hi]) => lo + rng() * (hi - lo));
    pop.push(x);
    fit.push(evalAt(x));
  }

  const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
  const pickOther = (exclude: number[]): number => {
    let r: number;
    do {
      r = Math.floor(rng() * np);
    } while (exclude.includes(r));
    return r;
  };

  let iterations = 0;
  let converged = false;
  for (let gen = 0; gen < maxIter; gen++) {
    for (let i = 0; i < np; i++) {
      const r1 = pickOther([i]);
      const r2 = pickOther([i, r1]);
      const r3 = pickOther([i, r1, r2]);
      const jRand = Math.floor(rng() * dim);
      const trial = pop[i].slice();
      for (let j = 0; j < dim; j++) {
        if (j === jRand || rng() < CR) {
          const [lo, hi] = bounds[j];
          trial[j] = clamp(pop[r1][j] + F * (pop[r2][j] - pop[r3][j]), lo, hi);
        }
      }
      const ft = evalAt(trial);
      if (ft <= fit[i]) {
        pop[i] = trial;
        fit[i] = ft;
      }
    }
    iterations = gen + 1;
    const fMin = Math.min(...fit);
    const fMax = Math.max(...fit);
    if (fMax - fMin <= tol * (1 + Math.abs(fMin))) {
      converged = true;
      break;
    }
  }

  let best = 0;
  for (let i = 1; i < np; i++) {
    if (fit[i] < fit[best]) best = i;
  }
  return { x: pop[best].slice(), fx: fit[best], iterations, evaluations, converged };
}

/**
 * Minimize `f` from `x0` by simulated annealing (Metropolis acceptance,
 * geometric cooling `T ← cooling · T`). The proposal width for coordinate `i`
 * is `0.1 · (T / T0) · scale_i`, where `scale_i` is the bound width when
 * `bounds` is given and `max(1, |x_i|)` otherwise.
 *
 * Stops when `T < tol` (`converged: true`) or after `maxIter` iterations.
 *
 * @example
 * simulatedAnnealing((x) => (x[0] - 3) ** 2, [0], { seed: 7 }).x // ~[3]
 */
export function simulatedAnnealing(
  f: (x: number[]) => number,
  x0: readonly number[],
  opts: SimulatedAnnealingOptions = {}
): GlobalOptimizeResult {
  if (x0.length === 0) {
    throw new RangeError('x0 must contain at least one coordinate');
  }
  if (opts.bounds !== undefined) {
    validateBounds(opts.bounds);
    if (opts.bounds.length !== x0.length) {
      throw new RangeError('bounds length must match x0 length');
    }
  }
  const maxIter = opts.maxIter ?? 10000;
  const tol = opts.tol ?? 1e-8;
  const T0 = opts.T0 ?? 1;
  const cooling = opts.cooling ?? 0.995;
  if (!(cooling > 0 && cooling < 1)) {
    throw new RangeError('cooling must lie in (0, 1)');
  }
  const bounds = opts.bounds;
  const rng = createRng(opts.seed ?? 0);
  const gaussian = (): number => {
    const u1 = Math.max(rng(), Number.MIN_VALUE);
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  let evaluations = 0;
  const evalAt = (x: number[]): number => {
    evaluations++;
    return safeEval(f, x);
  };

  let x = x0.slice();
  if (bounds) {
    x = x.map((v, i) => Math.min(bounds[i][1], Math.max(bounds[i][0], v)));
  }
  let fx = evalAt(x);
  let best = x.slice();
  let fBest = fx;
  let T = T0;

  let iterations = 0;
  let converged = false;
  while (iterations < maxIter) {
    if (T < tol) {
      converged = true;
      break;
    }
    const scaleFactor = 0.1 * (T / T0);
    const cand = x.map((v, i) => {
      const scale = bounds ? bounds[i][1] - bounds[i][0] : Math.max(1, Math.abs(v));
      let next = v + scaleFactor * scale * gaussian();
      if (bounds) next = Math.min(bounds[i][1], Math.max(bounds[i][0], next));
      return next;
    });
    const fc = evalAt(cand);
    if (fc <= fx || rng() < Math.exp(-(fc - fx) / T)) {
      x = cand;
      fx = fc;
      if (fx < fBest) {
        fBest = fx;
        best = x.slice();
      }
    }
    T *= cooling;
    iterations++;
  }

  return { x: best, fx: fBest, iterations, evaluations, converged };
}
