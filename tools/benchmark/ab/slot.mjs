/**
 * Timing primitives for one slot (base or head) of an A/B child.
 *
 * `child.mjs` imports this file once per slot with a distinct `?slot=` query, so each slot runs
 * its own copy of these functions. A single shared `timeBatch` has one call site `fn()` that
 * sees both trees' thunks, and the engine's type feedback for that site (and the inlining
 * decisions built on it) then favours whichever thunk it saw first. On Bun an identical pair of
 * trees read 0.66 for `prod` for that reason alone; separate copies read 1.00.
 */

/**
 * @param {() => unknown} fn
 * @param {number} reps
 * @returns {number} microseconds per call
 */
export function timeBatch(fn, reps) {
  const t0 = performance.now();
  let last;
  for (let i = 0; i < reps; i++) last = fn();
  const ms = performance.now() - t0;
  if (last === Symbol.for('perf-ab-never')) throw new Error('unreachable');
  return (ms * 1000) / reps;
}

/**
 * Pick a batch size of about 25 ms. A single call that takes longer is its own batch.
 * @param {() => unknown} fn
 * @returns {{ reps: number, batchMs: number }}
 */
export function calibrateReps(fn) {
  let reps = 1;
  let ms = 0;
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now();
    for (let j = 0; j < reps; j++) fn();
    ms = performance.now() - t0;
    if (reps === 1 && ms > 40) return { reps, batchMs: ms };
    if (ms >= 20 && ms <= 40) return { reps, batchMs: ms };
    if (ms < 1) reps *= 4;
    else reps = Math.max(1, Math.round((reps * 25) / Math.max(ms, 0.01)));
  }
  return { reps: Math.max(1, reps), batchMs: ms };
}
