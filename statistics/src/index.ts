/**
 * @danielsimonjr/mathts-statistics
 *
 * Standalone statistics functions for MathTS. Re-exports the `statistics` typed-function domain
 * from {@link @danielsimonjr/mathts-functions} as a focused package. The
 * implementation lives in functions; this is an entry point, not a copy.
 *
 * @packageDocumentation
 */

export {
  parallelStatSum,
  parallelStatMean,
  parallelStatVariance,
  parallelStatStd,
  parallelStatMin,
  parallelStatMax,
  parallelStatMinMax,
  parallelStatMedian,
  parallelStatMode,
  parallelStatProd,
  parallelStatNorm,
  parallelStatDistance,
  parallelStatCorr,
  parallelStatMAD,
  parallelStatCumsum,
  parallelStatQuantile,
  parallelStatPercentile,
  parallelStatHistogram,
  quickSelect,
  medianSelect,
  minSelect,
  maxSelect,
  typedStatistics,
} from '@danielsimonjr/mathts-functions';
