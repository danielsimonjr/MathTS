/**
 * The exact (factory) reductions that the typed `sum` falls back to. The factory layer imports the
 * typed arithmetic module, so the typed module cannot import the factories itself. The factory
 * layer registers them once, when it is defined. This module is internal: it is not re-exported.
 */

export type ExactReductionFn = (...args: unknown[]) => unknown;

export interface ExactReductions {
  sum: ExactReductionFn;
  mean: ExactReductionFn;
  min: ExactReductionFn;
  max: ExactReductionFn;
  variance: ExactReductionFn;
  sqrt: ExactReductionFn;
  dot: ExactReductionFn;
}

const registered: { fns?: ExactReductions } = {};

/**
 * Register the exact reductions. Called once by the factory layer.
 *
 * @param fns - The factory reductions that the typed functions fall back to.
 */
export function registerExactReductions(fns: ExactReductions): void {
  registered.fns = fns;
}

/**
 * The registered exact reductions.
 *
 * @returns The exact reductions.
 * @throws Error when the factory layer has not registered them.
 */
export function exactReductions(): ExactReductions {
  if (registered.fns === undefined) {
    throw new Error('exact reductions are not registered');
  }
  return registered.fns;
}
