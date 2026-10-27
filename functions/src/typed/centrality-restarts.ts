import type { RestartAggregation } from './aggregate-restart.js';

/**
 * Minimum restart count before fanning out via Promise.all rather than running
 * sequentially.
 */
export const CENTRALITY_WORKER_THRESHOLD = 4;

/**
 * Run multiple centrality restarts sequentially or via Promise.all fan-out.
 * Callers handle `restarts === 1` before invoking.
 * @internal
 */
export async function runCentralityRestarts<T>(
  restarts: number,
  baseSeed: number,
  splitSeed: (baseSeed: number, k: number) => number,
  once: (seed: number) => Float64Array,
  aggregate: (vectors: Float64Array[], aggregation: RestartAggregation) => T,
  aggregation: RestartAggregation
): Promise<T> {
  if (restarts < CENTRALITY_WORKER_THRESHOLD) {
    const vectors: Float64Array[] = [];
    for (let k = 0; k < restarts; k++) {
      const seed = splitSeed(baseSeed, k);
      vectors.push(once(seed === 0 ? 1 : seed));
    }
    return aggregate(vectors, aggregation);
  }

  const tasks: Promise<Float64Array>[] = [];
  for (let k = 0; k < restarts; k++) {
    const seed = splitSeed(baseSeed, k);
    const s = seed === 0 ? 1 : seed;
    tasks.push(Promise.resolve(once(s)));
  }
  const vectors = await Promise.all(tasks);
  return aggregate(vectors, aggregation);
}
