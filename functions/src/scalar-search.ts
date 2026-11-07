/**
 * Evolutionary search over {@link ScalarNode} trees.
 *
 * `populations` islands each evolve by tournament selection and
 * {@link weightedMutation}. Each generation breeds `populationSize` offspring per
 * island from tournament winners, evaluates every island's batch at the same time
 * (the score calls overlap in this process when worker scoring is in use; each
 * island keeps its own rng; without `parallel`, or below the row threshold, scoring
 * stays on the caller thread and overlap buys no throughput), and
 * keeps the best `populationSize` distinct trees of parents and offspring per
 * island (elitist truncation, not age-based replacement), applied in island-index
 * order after every island's batch has finished. After every generation the islands
 * exchange their best trees (migration). A hall of fame shared by every island keeps the best loss
 * per complexity among stored trees and one evaluated tree per {@link scalarCanonicalKey}
 * (loss first, then complexity, then first recorded); its Pareto front is reported
 * through {@link paretoFront} and {@link scoreFront}. Subtree crossover
 * ({@link crossoverSubtrees}) is opt-in:
 * {@link ScalarSearchOptions.crossoverProbability} defaults to 0, so the
 * offspring loop stays mutation-only and the default random stream is unchanged.
 *
 * @packageDocumentation
 */

import { createSeededRng, pairwiseSum, type SeededRng } from '@danielsimonjr/mathts-core';
import type { WorkerPool } from '@danielsimonjr/mathts-parallel';
import {
  enumerateScalars,
  scalarCanonicalKey,
  scalarComplexity,
  scalarGrammarAccepts,
  ScalarBuildError,
  type ScalarComplexityWeights,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import {
  fitScalarParameters,
  namedScalarLossTerm,
  rankScalarBatchLoss,
  INVALID_ROW_PENALTY,
  type NamedScalarLoss,
} from './fit-scalar.js';
import * as scalarFactories from './factories/index.js';
import { paretoFront, scoreFront, selectFrontModel, type ScoredCandidate } from './pareto-front.js';
import {
  createScalarBatchPool,
  evaluateScalarPopulation,
  resolveParallelTimeout,
  type ScalarPopulationParallelOptions,
} from './scalar-batch-parallel.js';
import { compileScalar, type ScalarBatchResult } from './scalar-compile.js';
import {
  crossoverSubtrees,
  simplifyConstants,
  weightedMutation,
  type ScalarMutationContext,
} from './scalar-mutate.js';
import {
  inferScalarDimension,
  rationalDimensionsEqual,
  solveParameterDimensions,
  validateDimensionVector,
  type RationalDimension,
} from './scalar-dimension.js';

/** Columnar regression target for {@link searchScalars}. */
export interface ScalarSearchProblem {
  /** Names of the input columns, in the order of `columns`. */
  readonly variables: readonly string[];
  /** One column per variable; every column has `observed.length` rows. */
  readonly columns: readonly Float64Array[];
  /** Target values. Must be finite. */
  readonly observed: Float64Array;
  /** Fitted constants. Defaults to `grammar.parameters`. */
  readonly parameters?: readonly string[];
}

/**
 * Opt-in SI dimension filter for the scalar search
 * ({@link ScalarSearchOptions.dimensions}).
 *
 * `symbols` binds variable and parameter names to dimensions. A name omitted
 * from `symbols` is a solver unknown when it is a parameter and
 * `unknown-symbol` when it is a variable. `target` is the dimension the scored
 * tree's root must have. `onUnderdetermined` decides a solve whose parameter
 * dimensions are not fixed by the equations implied by the tree: `'keep'` (the
 * default) scores the tree normally — for example `x^p` with a free exponent
 * parameter stays scorable under any `target` because the solver does not assign
 * a unique dimension to `p`. `'reject'` scores it `Infinity`. Listed grammar
 * parameters that do not appear in the tree are ignored for underdetermined
 * detection. Before the first yield the filter is copied into a frozen snapshot
 * (plain-data `symbols` only, same rules as `complexityWeights`).
 */
export interface ScalarDimensionFilter {
  readonly symbols: Readonly<Record<string, RationalDimension>>;
  readonly target: RationalDimension;
  readonly onUnderdetermined?: 'keep' | 'reject';
  /** Caller equality for the inferred root dimension and `target` (infer mode only). A `false` result or a throw scores `Infinity`. Omitted: exact per-axis equality. */
  readonly equal?: (left: RationalDimension, right: RationalDimension) => boolean;
}

/**
 * When adaptive parsimony records offspring complexities within one generation.
 * @internal Test hook only; not on the package barrel.
 */
export type FrequencyRecordTiming = 'island-boundary' | 'after-merge' | 'per-offspring';

/** Budget and evolution knobs for {@link searchScalars}. */
export interface ScalarSearchOptions {
  readonly grammar: ScalarGrammar;
  /** Not advanced by the search: every stream is a `fork` of it. */
  readonly rng: SeededRng;
  /** Trees per population. Default 27. */
  readonly populationSize?: number;
  /** Contestants per tournament. Default 15. */
  readonly tournamentSize?: number;
  /** Chance that the best contestant wins; rank `r` wins with `p (1 - p)^r`. Default 0.982. */
  readonly tournamentP?: number;
  /** Chance that an evaluated tree has its parameters refitted. Default 0.14. */
  readonly optimizeProbability?: number;
  /**
   * Residual loss for ranking and for every refit. Default `'l2'`: today's sum of
   * squares, including `+Infinity` when any row is invalid. `'l1'` and `'huber'`
   * reuse {@link fitScalarParameters}'s named losses. Omitted is the default
   * branch, so the seed-7 pin is unchanged.
   */
  readonly loss?: NamedScalarLoss;
  /**
   * Per-row weights for that loss. Length must equal `observed.length`; every
   * weight is finite and `>= 0`. A zero weight drops that row. Omitted: every
   * row weighs 1.
   */
  readonly rowWeights?: Float64Array;
  /**
   * How a tree that is invalid on at least one row is ranked. Default `'reject'`:
   * today's `+Infinity` — such a tree never enters the hall. `'penalize'` scores
   * {@link INVALID_ROW_PENALTY} (the fitter's existing invalid-row penalty) times
   * the number of invalid rows a positive `rowWeights` entry covers, plus the
   * chosen `loss` on the valid rows; a zero-weight row is dropped on both sides.
   * A tree with no valid row reports the penalty times the number of positively
   * weighted rows (each invalid among them adds one penalty). The penalty is
   * absolute, not scaled to the target magnitude. The ranker adds that sum on top
   * of the valid-row loss; the fitter's reported loss counts only valid rows and
   * freezes invalid rows with a squared penalty inside LM — different objectives.
   * Refit acceptance compares both sides with {@link scoreOnProblem} / the ranker.
   * Omitted is the default branch, so the seed-7 pin is unchanged.
   */
  readonly invalidRows?: 'reject' | 'penalize';
  /**
   * Per-node weights for the complexity the hall, the truncation tie-break, and
   * adaptive parsimony rank by. `ScalarComplexityWeights` from
   * `@danielsimonjr/mathts-expression`; omitted fields weigh 1, so `{}` (and an
   * omitted option) is today's node count. Weights are normalized once before the
   * first yield into a frozen snapshot; only plain data objects are accepted at
   * the top level and on `op`, `call`, and per-name `symbol` records (prototype
   * `Object.prototype` or `null`). Own keys are read exactly once via
   * `Reflect.ownKeys`; non-enumerable keys and accessor properties throw
   * `RangeError`. Every weight must be a finite number; weights that would make
   * `grammar.maxSize` nodes sum to a non-finite complexity also throw before the
   * first yield. Zero and negative weights are accepted: they are summed and
   * `Math.round`ed by `scalarComplexity` like any other weight. Nested record
   * keys must use lowered call names (`ln` is stored as `log`); unknown keys are
   * kept in the snapshot but ignored at scoring time.
   */
  readonly complexityWeights?: ScalarComplexityWeights;
  /**
   * Refit knobs forwarded to {@link fitScalarParameters}. An omitted field is
   * today's call: `restarts` 2, `maxIterations` 8, no bounds, the fitter's
   * default algorithm, and `initial` set to the inherited vector (ones for the
   * initial population). The values are forwarded, not reimplemented; a bad
   * bound or length throws the fitter's `RangeError` before the first yield.
   */
  readonly fit?: ScalarFitOptions;
  /**
   * Chance that an offspring is a subtree crossover of two tournament parents
   * instead of a mutation of the first. Default 0: the coin is not drawn, so the
   * random stream matches a search that never had this option. In (0, 1] the
   * island stream draws the coin; on success a second parent is drawn with the
   * same tournament, {@link crossoverSubtrees} runs, and the child is kept when
   * it is non-null and the grammar (including `admit`) accepts it. Otherwise the search falls
   * through to the existing mutation attempts. The inherited parameter vector
   * is always the first parent's.
   */
  readonly crossoverProbability?: number;
  /**
   * Simplify each seed and each bred offspring once, before the grammar check and
   * the score, so the scored tree is the tree whose parameters are fitted. Default
   * `'off'`: neither simplifier runs and the seed-7 pin is unchanged. `'constants'`
   * folds numeric-only subtrees ({@link simplifyConstants}). `'algebraic'` runs the
   * expression simplifier ({@link simplifyScalar}); when it throws
   * `ScalarBuildError`, or its result fails the grammar (including `admit`), the
   * tree keeps its unsimplified shape. Trees that come out of `enumerateScalars`
   * are not simplified. Simplification draws no random numbers, but different
   * accepted trees can change how many mutation attempts succeed, so a run with
   * `simplify` on may diverge from an otherwise identical run with `'off'`; two
   * runs that share the same `simplify` mode and seed still match. Progress event
   * count stays budget-driven (`maxEvaluations`). When the simplified tree fails
   * the grammar, changes the valid/invalid pattern on a positively weighted row,
   * or disagrees in value within tolerance on such a row, the unsimplified tree
   * is kept. `admit` runs on the simplified tree when its canonical key differs;
   * a no-op fold (same key) is checked once. Algebraic simplification costs
   * milliseconds per tree; the option stays off by default and no speed claim is
   * made here.
   */
  readonly simplify?: 'off' | 'constants' | 'algebraic';
  /**
   * Opt-in SI dimension filter. Omitted: no dimension walk and the seed-7 pin is
   * unchanged. Set: after the grammar check (and any simplification) and before
   * the score, the tree that will be scored is checked. With parameters the
   * check is {@link solveParameterDimensions} when the fitted parameter list is
   * non-empty; an empty `problem.parameters` array forces infer mode even when
   * the grammar lists parameters. Without fitted parameters the check is
   * {@link inferScalarDimension}. In both modes the inferred or solved root
   * dimension must equal `target`.
   * An `add-mismatch`, `transcendental-arg-not-dimensionless`,
   * `non-literal-exponent-on-dimensional-base`, or `unknown-symbol` violation,
   * or an `inconsistent` solve, scores `Infinity` and never enters the hall —
   * the same bucket as a numerical failure — but still counts as an evaluation.
   * An underdetermined solve is scored normally (`'keep'`, the default) or
   * scored `Infinity` (`'reject'`). The check draws no random numbers.
   */
  readonly dimensions?: ScalarDimensionFilter;
  /** Cap on tree evaluations, the initial population included. */
  readonly maxEvaluations: number;
  /** Second cap on tree evaluations, reported as `'max-candidates'`. */
  readonly maxCandidates?: number;
  /**
   * Trees injected into the initial population (`seeds`). The grammar's structural
   * rules filter them, and so does `grammar.admit` when it is set.
   */
  readonly seeds?: readonly ScalarNode[];
  /** Constant-perturbation scale handed to the mutations. Default 0.25. */
  readonly perturbationFactor?: number;
  /** How `selected` is chosen from the front. Omitted: no selection. */
  readonly modelSelection?: 'accuracy' | 'score' | 'best';
  /**
   * Independent islands, each with `populationSize` trees and its own random stream
   * (`rng.fork('island:' + index)`). Default 1, which draws from `rng.fork('population')`.
   * Evaluations are counted across all islands. The islands' score calls overlap
   * within one generation when worker scoring is active; without `parallel`, or below
   * the row threshold, evaluation stays on the caller thread and overlap does not
   * increase throughput. The merge after the scores runs in island-index order.
   */
  readonly populations?: number;
  /**
   * @internal Test hook only: when offspring complexities reach the adaptive-parsimony
   * window within a generation. Default `island-boundary` matches the sequential schedule.
   */
  readonly frequencyRecordTiming?: FrequencyRecordTiming;
  /**
   * Expected share of each island replaced by another island's best trees after every
   * generation, in [0, 1]. The count is the expectation rounded at random. Default 0.00036
   * (`fractionReplaced`).
   */
  readonly fractionReplaced?: number;
  /**
   * Shrink the constant perturbation scale over the run: the mutation temperature starts
   * at `initialTemperature` and is multiplied by 0.995 after every generation. Default:
   * on when `populations > 1`, so a single population stays the M13a search.
   */
  readonly annealing?: boolean;
  /** Starting temperature when `annealing` is on. Default 3.17. */
  readonly initialTemperature?: number;
  /**
   * Rank tournament contestants by `loss * exp(adaptiveParsimonyScaling * f)`, where `f`
   * is the share of recent evaluations that had the contestant's complexity. Crowded
   * sizes lose, so the population explores every size. Default: on when `populations > 1`.
   */
  readonly adaptiveParsimony?: boolean;
  /** Strength of the adaptive-parsimony penalty. Default 1040. */
  readonly adaptiveParsimonyScaling?: number;
  /**
   * Evaluate every generation's trees on worker threads (M14) once `observed` has at least
   * 100 rows; below that, and when omitted, evaluation stays on the caller thread. The
   * workers return the values the caller thread would compute, bit for bit, and parameter
   * refits and every random draw stay on the caller thread, so a parallel run equals the
   * serial run for the same seed. Overlapped islands only overlap worker score calls; the
   * caller-thread path does not gain throughput from SR-13. `timeoutMs` (default 30000,
   * must be positive) bounds each worker task, including time queued behind other islands'
   * submissions in the same generation — scale it with `populations` when several islands
   * score together. A `pool` you pass is yours to terminate; without one the search starts
   * a pool when it first needs it and terminates it when the generator finishes or is closed.
   */
  readonly parallel?: ScalarPopulationParallelOptions;
  /**
   * Cancellation signal (SR-15). The search checks it before the initial population
   * and between generations, never in the middle of a random draw or a scored batch.
   * Already aborted before the first yield: the result has an empty front,
   * `evaluations: 0`, and `stopReason: 'cancelled'`. Aborted after a yield: the
   * generator returns the last progress as the result with `stopReason: 'cancelled'`
   * and does not start another generation (a generation that was already breeding
   * and scoring runs to completion first). A pool the search owns is still
   * terminated. Omitted: no cancellation and the seed-7 pin is unchanged.
   */
  readonly signal?: AbortSignal;
  /**
   * Optional early stop (SR-15). Omitted: the search always runs to
   * `max-evaluations` (or `'max-candidates'`). Set: after a generation whose best
   * finite hall loss is `<= loss`, and that has stayed true for `generations`
   * consecutive generations, the search returns `stopReason: 'early-stop'` after
   * yielding that generation's progress. The streak is counted over the hall after
   * the generation (the initial population included), and it resets when a
   * generation leaves the best loss above `loss` — the best hall loss can only
   * improve, so a reset happens only while the hall is still empty or the best
   * loss has not yet reached `loss`. `loss` must be finite and `generations` an
   * integer `>= 1` (`RangeError` otherwise). A run that never reaches `loss`
   * still ends on `'max-evaluations'`.
   */
  readonly earlyStop?: { readonly loss: number; readonly generations: number };
  /**
   * Factor forwarded to {@link selectFrontModel}'s `bestLossFactor` when
   * `modelSelection` is set (SR-16). Omitted: the factor `selectFrontModel`
   * already defaults to (1.5), so today's call is unchanged. A non-finite value
   * throws `RangeError` before the search starts, even when `modelSelection` is
   * omitted. Only read when `modelSelection` is set. Values in `(0, 1)` can make
   * the `'best'` filter keep no row once selection runs, which throws
   * {@link ParetoFrontError} mid-run; `1` is the safe lower boundary (only
   * minimum-loss rows qualify).
   */
  readonly bestLossFactor?: number;
}

/** Budget, bounds, and start-vector knobs for the search's parameter refits. */
export interface ScalarFitOptions {
  /** Restarted fits per refit. Default 2. Must be an integer >= 0. */
  readonly restarts?: number;
  /** Optimizer iterations per fit. Default 8. Must be an integer >= 0. */
  readonly maxIterations?: number;
  /**
   * One `[lo, hi]` pair per parameter. Endpoints are finite or `±Infinity`;
   * `lo` must not exceed `hi`, and the length must equal the parameter count.
   * Default: unbounded.
   */
  readonly bounds?: readonly (readonly [number, number])[];
  /** Optimizer. Default: the fitter's choice (`'lm'` for `'l2'`, `'bfgs'` otherwise). */
  readonly algorithm?: 'lm' | 'bfgs' | 'nelder-mead';
  /**
   * Start vector of every refit. Length must equal the parameter count and every
   * value must be finite. Default: the tree's inherited vector (ones at the
   * initial population).
   */
  readonly initial?: ArrayLike<number>;
}

/** One progress event; `status` is always `'fitted'`. */
export interface SearchProgress {
  readonly status: 'fitted';
  readonly evaluations: number;
  /** Pareto front of the hall of fame, ascending complexity. */
  readonly front: ScoredCandidate<ScalarNode>[];
  /** Names that `fittedParameters` rows are ordered by. */
  readonly parameterNames: readonly string[];
  /** Parameter values behind each `front` row's loss; same order as `front`. */
  readonly fittedParameters: Float64Array[];
  readonly selected?: ScoredCandidate<ScalarNode>;
}

export type ScalarSearchStopReason =
  'max-evaluations' | 'max-candidates' | 'cancelled' | 'early-stop';

/** Final value of the async generator returned by {@link searchScalars}. */
export interface ScalarSearchResult {
  readonly front: ScoredCandidate<ScalarNode>[];
  readonly parameterNames: readonly string[];
  readonly fittedParameters: Float64Array[];
  readonly stopReason: ScalarSearchStopReason;
  readonly evaluations: number;
  readonly seed: number;
  readonly selected?: ScoredCandidate<ScalarNode>;
  /**
   * How often a seed or offspring kept its unsimplified shape because simplification
   * threw (other than `ScalarBuildError`), failed the grammar or row-wise evaluation
   * check, or hit a `RangeError` from a deep simplify. Zero when `simplify` is
   * `'off'` or omitted.
   */
  readonly simplifyFallbacks: number;
}

/** @internal Exported for unit tests; not part of the package barrel. */
export function simplifyCandidateForTest(
  node: ScalarNode,
  mode: ScalarSearchOptions['simplify'],
  recordFallback?: () => void
): ScalarNode {
  return simplifyCandidate(node, mode, recordFallback);
}

/** @internal Exported for unit tests; not part of the package barrel. */
export function hallFrontForTest(individuals: readonly EvaluatedIndividual[]): {
  front: ScoredCandidate<ScalarNode>[];
  fittedParameters: Float64Array[];
} {
  const hall = new HallOfFame();
  for (const ind of individuals) {
    hall.add(ind);
  }
  return hall.front();
}

/** @internal One evaluated tree; exported for the unit tests, not the package barrel. */
export interface EvaluatedIndividual {
  readonly node: ScalarNode;
  readonly key: string;
  readonly loss: number;
  readonly complexity: number;
  readonly parameters: Float64Array;
}

const DEFAULT_POPULATION_SIZE = 27;
const DEFAULT_TOURNAMENT_SIZE = 15;
const DEFAULT_TOURNAMENT_P = 0.982;
const DEFAULT_OPTIMIZE_PROBABILITY = 0.14;
const DEFAULT_CROSSOVER_PROBABILITY = 0;
const DEFAULT_PERTURBATION_FACTOR = 0.25;
const DEFAULT_FRACTION_REPLACED = 0.00036;
const DEFAULT_INITIAL_TEMPERATURE = 3.17;
const DEFAULT_PARSIMONY_SCALING = 1040;

/** Tries a mutation this often before an offspring falls back to a copy of its parent. */
const MUTATION_ATTEMPTS = 10;

/** The mutation temperature is multiplied by this after every generation. */
const TEMPERATURE_DECAY = 0.995;

/** Migrants are drawn from the best this-many trees of the donor island. */
const MIGRANT_POOL = 12;

/** Evaluations that the complexity frequencies remember (running window). */
const FREQUENCY_WINDOW = 100_000;

/** Row-wise agreement when accepting a simplified tree (positively weighted rows only). */
const SIMPLIFY_EVAL_REL_TOL = 1e-12;
const SIMPLIFY_EVAL_ABS_TOL = 1e-14;

function paramNames(problem: ScalarSearchProblem, grammar: ScalarGrammar): readonly string[] {
  return problem.parameters ?? grammar.parameters ?? [];
}

function positiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`searchScalars: ${name} must be an integer >= 1, got ${value}`);
  }
}

function probability(name: string, value: number): void {
  if (!(value >= 0 && value <= 1)) {
    throw new RangeError(`searchScalars: ${name} must be in [0, 1], got ${value}`);
  }
}

function nonNegativeFinite(name: string, value: number): void {
  if (!(Number.isFinite(value) && value >= 0)) {
    throw new RangeError(`searchScalars: ${name} must be a finite number >= 0, got ${value}`);
  }
}

/**
 * The same checks {@link fitScalarParameters} runs on these fields, applied before
 * the first yield so a bad `fit` fails every run of the options, not only the
 * runs whose refit coin fires.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Plain data object only — rejects `Map`, typed arrays, `Date`, and class instances. */
function isDataPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function complexityWeightDescriptorError(path: string, reason: string): never {
  throw new RangeError(`searchScalars: complexityWeights ${path} ${reason}`);
}

function readComplexityWeightValue(path: string, value: unknown): number {
  if (value === undefined) {
    complexityWeightDescriptorError(path, 'must not be undefined when read');
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    complexityWeightDescriptorError(path, `must be a finite number, got ${String(value)}`);
  }
  if (value < 0) {
    complexityWeightDescriptorError(path, `must be >= 0, got ${value}`);
  }
  return value;
}

function readOwnComplexityWeightRecord(
  path: string,
  record: Record<string, unknown>
): Record<string, number> {
  if (!isDataPlainObject(record)) {
    complexityWeightDescriptorError(path, `must be a plain object, got ${String(record)}`);
  }
  const out: Record<string, number> = {};
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== 'string') {
      complexityWeightDescriptorError(path, 'own keys must be strings');
    }
    const desc = Object.getOwnPropertyDescriptor(record, key);
    if (desc === undefined) {
      continue;
    }
    if (!desc.enumerable) {
      complexityWeightDescriptorError(
        `${path}.${key}`,
        'must be an enumerable own property (non-enumerable keys are rejected)'
      );
    }
    if (desc.get !== undefined || desc.set !== undefined) {
      complexityWeightDescriptorError(`${path}.${key}`, 'must be a data property, not an accessor');
    }
    if (desc.value === undefined) {
      continue;
    }
    out[key] = readComplexityWeightValue(`${path}.${key}`, desc.value);
  }
  return out;
}

function readOptionalTopComplexityField(
  weights: Record<string, unknown>,
  key: 'number' | 'op' | 'call' | 'symbol'
): unknown {
  if (!Object.prototype.hasOwnProperty.call(weights, key)) {
    return undefined;
  }
  const desc = Object.getOwnPropertyDescriptor(weights, key);
  if (desc === undefined) {
    return undefined;
  }
  if (!desc.enumerable) {
    complexityWeightDescriptorError(
      key,
      'must be an enumerable own property (non-enumerable keys are rejected)'
    );
  }
  if (desc.get !== undefined || desc.set !== undefined) {
    complexityWeightDescriptorError(key, 'must be a data property, not an accessor');
  }
  return desc.value;
}

/**
 * Validates `complexityWeights` once, copies every own enumerable data property into a
 * fresh snapshot, and freezes it so later caller mutation or accessor tricks cannot
 * change the run. Unknown keys on nested records are stored but ignored by
 * {@link scalarComplexity}; keys must use lowered call names (`ln` is stored as `log`).
 */
function normalizeComplexityWeights(
  weights: ScalarComplexityWeights,
  maxSize: number
): Readonly<ScalarComplexityWeights> {
  if (!isDataPlainObject(weights)) {
    throw new RangeError(
      `searchScalars: complexityWeights must be a plain object, got ${String(weights)}`
    );
  }
  const snapshot: {
    number?: number;
    op?: Record<string, number>;
    call?: Record<string, number>;
    symbol?: number | Record<string, number>;
  } = {};
  let maxNodeWeight = 1;
  const noteWeight = (w: number): void => {
    maxNodeWeight = Math.max(maxNodeWeight, Math.abs(w));
  };

  const numberVal = readOptionalTopComplexityField(weights, 'number');
  if (numberVal !== undefined) {
    snapshot.number = readComplexityWeightValue('number', numberVal);
    noteWeight(snapshot.number);
  }

  const opVal = readOptionalTopComplexityField(weights, 'op');
  if (opVal !== undefined) {
    snapshot.op = readOwnComplexityWeightRecord('op', opVal as Record<string, unknown>);
    for (const w of Object.values(snapshot.op)) {
      noteWeight(w);
    }
  }

  const callVal = readOptionalTopComplexityField(weights, 'call');
  if (callVal !== undefined) {
    snapshot.call = readOwnComplexityWeightRecord('call', callVal as Record<string, unknown>);
    for (const w of Object.values(snapshot.call)) {
      noteWeight(w);
    }
  }

  const symbolVal = readOptionalTopComplexityField(weights, 'symbol');
  if (symbolVal !== undefined) {
    if (typeof symbolVal === 'number') {
      snapshot.symbol = readComplexityWeightValue('symbol', symbolVal);
      noteWeight(snapshot.symbol);
    } else {
      snapshot.symbol = readOwnComplexityWeightRecord(
        'symbol',
        symbolVal as Record<string, unknown>
      );
      for (const w of Object.values(snapshot.symbol)) {
        noteWeight(w);
      }
    }
  }

  maxNodeWeight = Math.max(maxNodeWeight, 1);
  const worstSum = maxSize * maxNodeWeight;
  if (!Number.isFinite(worstSum)) {
    throw new RangeError(
      `searchScalars: complexityWeights would produce non-finite complexity at grammar.maxSize ${maxSize}`
    );
  }

  return Object.freeze(snapshot) as Readonly<ScalarComplexityWeights>;
}

function cloneDimensionVector(vector: RationalDimension, label: string): RationalDimension {
  validateDimensionVector(vector, label);
  return vector.map((entry) => entry.clone()) as unknown as RationalDimension;
}

function dimensionSymbolsDescriptorError(path: string, reason: string): never {
  throw new RangeError(`searchScalars: dimensions.symbols ${path} ${reason}`);
}

function readDimensionSymbolsRecord(
  symbolsVal: unknown
): Readonly<Record<string, RationalDimension>> {
  if (!isDataPlainObject(symbolsVal)) {
    throw new RangeError(
      `searchScalars: dimensions.symbols must be a plain object, got ${String(symbolsVal)}`
    );
  }
  const out: Record<string, RationalDimension> = {};
  for (const key of Reflect.ownKeys(symbolsVal)) {
    if (typeof key !== 'string') {
      dimensionSymbolsDescriptorError('', 'own keys must be strings');
    }
    const desc = Object.getOwnPropertyDescriptor(symbolsVal, key);
    if (desc === undefined) {
      continue;
    }
    if (!desc.enumerable) {
      dimensionSymbolsDescriptorError(
        key,
        'must be an enumerable own property (non-enumerable keys are rejected)'
      );
    }
    if (desc.get !== undefined || desc.set !== undefined) {
      dimensionSymbolsDescriptorError(key, 'must be a data property, not an accessor');
    }
    if (desc.value === undefined) {
      continue;
    }
    out[key] = cloneDimensionVector(
      desc.value as RationalDimension,
      `searchScalars: dimensions.symbols['${key}']`
    );
  }
  return Object.freeze(out);
}

/**
 * Copy caller `dimensions` into a frozen snapshot before the first yield, mirroring
 * {@link normalizeComplexityWeights}.
 */
function normalizeDimensionFilter(raw: ScalarDimensionFilter): Readonly<ScalarDimensionFilter> {
  if (!isDataPlainObject(raw)) {
    throw new RangeError(`searchScalars: dimensions must be a plain object, got ${String(raw)}`);
  }
  const record = raw as Record<string, unknown>;
  if (!('symbols' in record)) {
    throw new RangeError('searchScalars: dimensions.symbols is required');
  }
  if (!('target' in record)) {
    throw new RangeError('searchScalars: dimensions.target is required');
  }
  const symbols = readDimensionSymbolsRecord(record.symbols);
  const target = cloneDimensionVector(
    record.target as RationalDimension,
    'searchScalars: dimensions.target'
  );
  const onUnderdetermined = record.onUnderdetermined;
  if (
    onUnderdetermined !== undefined &&
    onUnderdetermined !== 'keep' &&
    onUnderdetermined !== 'reject'
  ) {
    throw new RangeError(
      `searchScalars: dimensions.onUnderdetermined must be 'keep' or 'reject', got ${String(onUnderdetermined)}`
    );
  }
  const equal = record.equal;
  if (equal !== undefined && typeof equal !== 'function') {
    throw new RangeError(
      `searchScalars: dimensions.equal must be a function, got ${String(equal)}`
    );
  }
  return Object.freeze({
    symbols,
    target,
    onUnderdetermined: onUnderdetermined === 'reject' ? 'reject' : 'keep',
    ...(equal === undefined ? {} : { equal: equal as ScalarDimensionFilter['equal'] }),
  });
}

/** Keeps reported parameter vectors inside `fit.bounds` when bounds are set. */
function clampParametersToBounds(
  parameters: Float64Array,
  bounds: readonly (readonly [number, number])[]
): Float64Array {
  const out = Float64Array.from(parameters);
  for (let i = 0; i < out.length; i += 1) {
    const [lo, hi] = bounds[i]!;
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo === hi) {
      out[i] = lo;
      continue;
    }
    let x = out[i]!;
    if (Number.isFinite(lo)) {
      x = Math.max(lo, x);
    }
    if (Number.isFinite(hi)) {
      x = Math.min(hi, x);
    }
    out[i] = x;
  }
  return out;
}

function assertFitOptions(
  fit: ScalarFitOptions,
  parameterCount: number,
  loss: NamedScalarLoss
): void {
  if (fit.algorithm === 'lm' && loss !== 'l2') {
    throw new RangeError(
      `searchScalars: fit.algorithm 'lm' is only valid for loss 'l2', got loss '${loss}'`
    );
  }
  if (fit.restarts !== undefined && (!Number.isInteger(fit.restarts) || fit.restarts < 0)) {
    throw new RangeError(
      `searchScalars: fit.restarts must be an integer >= 0, got ${fit.restarts}`
    );
  }
  if (
    fit.maxIterations !== undefined &&
    (!Number.isInteger(fit.maxIterations) || fit.maxIterations < 0)
  ) {
    throw new RangeError(
      `searchScalars: fit.maxIterations must be an integer >= 0, got ${fit.maxIterations}`
    );
  }
  if (
    fit.algorithm !== undefined &&
    fit.algorithm !== 'lm' &&
    fit.algorithm !== 'bfgs' &&
    fit.algorithm !== 'nelder-mead'
  ) {
    throw new RangeError(
      `searchScalars: fit.algorithm must be 'lm', 'bfgs', or 'nelder-mead', got ${String(fit.algorithm)}`
    );
  }
  if (fit.initial !== undefined) {
    if (fit.initial.length !== parameterCount) {
      throw new RangeError(
        `searchScalars: fit.initial length must equal the parameter count (${parameterCount}), got ${fit.initial.length}`
      );
    }
    for (let i = 0; i < parameterCount; i += 1) {
      if (!Number.isFinite(Number(fit.initial[i]))) {
        throw new RangeError(`searchScalars: fit.initial[${i}] must be finite`);
      }
    }
  }
  if (fit.bounds !== undefined) {
    if (fit.bounds.length !== parameterCount) {
      throw new RangeError(
        `searchScalars: fit.bounds length must equal the parameter count (${parameterCount}), got ${fit.bounds.length}`
      );
    }
    for (let i = 0; i < parameterCount; i += 1) {
      const entry = fit.bounds[i];
      if (!Array.isArray(entry) || entry.length !== 2) {
        throw new RangeError(
          `searchScalars: fit.bounds[${i}] must be a [lo, hi] pair, got ${String(entry)}`
        );
      }
      const lo = entry[0] as number;
      const hi = entry[1] as number;
      const loOk = Number.isFinite(lo) || lo === Number.NEGATIVE_INFINITY;
      const hiOk = Number.isFinite(hi) || hi === Number.POSITIVE_INFINITY;
      if (!loOk || !hiOk) {
        throw new RangeError(
          `searchScalars: fit.bounds[${i}] endpoints must be finite or ±Infinity`
        );
      }
      if (lo > hi) {
        throw new RangeError(
          `searchScalars: fit.bounds[${i}] lower bound must not exceed the upper`
        );
      }
    }
  }
}

function assertSearchInputs(
  problem: ScalarSearchProblem,
  options: ScalarSearchOptions,
  populationSize: number,
  tournamentSize: number,
  tournamentP: number,
  optimizeProbability: number,
  crossoverProbability: number
): void {
  const rows = problem.observed.length;
  if (rows === 0) {
    throw new RangeError('searchScalars: observed must have at least one row');
  }
  if (problem.columns.length !== problem.variables.length) {
    throw new RangeError(
      `searchScalars: ${problem.variables.length} variables but ${problem.columns.length} columns`
    );
  }
  for (const column of problem.columns) {
    if (column.length !== rows) {
      throw new RangeError(
        `searchScalars: a column has ${column.length} rows, observed has ${rows}`
      );
    }
  }
  for (let i = 0; i < rows; i += 1) {
    if (!Number.isFinite(problem.observed[i])) {
      throw new RangeError(`searchScalars: observed[${i}] is not finite`);
    }
  }
  positiveInteger('populationSize', populationSize);
  positiveInteger('tournamentSize', tournamentSize);
  if (!(tournamentP > 0 && tournamentP <= 1)) {
    throw new RangeError(`searchScalars: tournamentP must be in (0, 1], got ${tournamentP}`);
  }
  probability('optimizeProbability', optimizeProbability);
  probability('crossoverProbability', crossoverProbability);
  positiveInteger('populations', options.populations ?? 1);
  probability('fractionReplaced', options.fractionReplaced ?? DEFAULT_FRACTION_REPLACED);
  nonNegativeFinite(
    'initialTemperature',
    options.initialTemperature ?? DEFAULT_INITIAL_TEMPERATURE
  );
  nonNegativeFinite(
    'adaptiveParsimonyScaling',
    options.adaptiveParsimonyScaling ?? DEFAULT_PARSIMONY_SCALING
  );
  if (Number.isNaN(options.maxEvaluations) || options.maxEvaluations < 0) {
    throw new RangeError(
      `searchScalars: maxEvaluations must be a number >= 0, got ${options.maxEvaluations}`
    );
  }
  if (
    options.maxCandidates !== undefined &&
    (Number.isNaN(options.maxCandidates) || options.maxCandidates < 0)
  ) {
    throw new RangeError(
      `searchScalars: maxCandidates must be a number >= 0, got ${options.maxCandidates}`
    );
  }
  if (
    options.loss !== undefined &&
    options.loss !== 'l2' &&
    options.loss !== 'l1' &&
    options.loss !== 'huber'
  ) {
    throw new RangeError(
      `searchScalars: loss must be 'l2', 'l1', or 'huber', got ${String(options.loss)}`
    );
  }
  if (options.rowWeights !== undefined) {
    if (!(options.rowWeights instanceof Float64Array)) {
      throw new RangeError('searchScalars: rowWeights must be a Float64Array');
    }
    if (options.rowWeights.length !== rows) {
      throw new RangeError(
        `searchScalars: rowWeights length must equal observed.length (${rows}), got ${options.rowWeights.length}`
      );
    }
    for (let i = 0; i < rows; i += 1) {
      const w = options.rowWeights[i]!;
      if (!Number.isFinite(w) || w < 0) {
        throw new RangeError(`searchScalars: rowWeights[${i}] must be finite and >= 0, got ${w}`);
      }
    }
  }
  if (
    options.invalidRows !== undefined &&
    options.invalidRows !== 'reject' &&
    options.invalidRows !== 'penalize'
  ) {
    throw new RangeError(
      `searchScalars: invalidRows must be 'reject' or 'penalize', got ${String(options.invalidRows)}`
    );
  }
  if (
    options.simplify !== undefined &&
    options.simplify !== 'off' &&
    options.simplify !== 'constants' &&
    options.simplify !== 'algebraic'
  ) {
    throw new RangeError(
      `searchScalars: simplify must be 'off', 'constants', or 'algebraic', got ${String(options.simplify)}`
    );
  }
  if (options.dimensions !== undefined && !isDataPlainObject(options.dimensions)) {
    throw new RangeError(
      `searchScalars: dimensions must be a plain object, got ${String(options.dimensions)}`
    );
  }
  if (options.earlyStop !== undefined) {
    if (!isDataPlainObject(options.earlyStop)) {
      throw new RangeError(
        `searchScalars: earlyStop must be a plain object, got ${String(options.earlyStop)}`
      );
    }
    if (!Number.isFinite(options.earlyStop.loss)) {
      throw new RangeError(
        `searchScalars: earlyStop.loss must be a finite number, got ${String(options.earlyStop.loss)}`
      );
    }
    positiveInteger('earlyStop.generations', options.earlyStop.generations);
  }
  if (options.bestLossFactor !== undefined && !Number.isFinite(options.bestLossFactor)) {
    throw new RangeError(
      `searchScalars: bestLossFactor must be a finite number, got ${String(options.bestLossFactor)}`
    );
  }
}

function defaultParameters(n: number): Float64Array {
  return new Float64Array(n).fill(1);
}

/** Order for losses: smaller first, `Infinity` last. Losses are never `NaN` here. */
function compareLoss(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface RankLoss {
  readonly name: NamedScalarLoss;
  readonly weights: Float64Array | undefined;
  readonly invalidRows: 'reject' | 'penalize';
}

interface Scored {
  readonly loss: number;
  readonly validRows: number;
}

/**
 * The `'penalize'` ranker: {@link INVALID_ROW_PENALTY} times each invalid row with
 * positive weight, plus the chosen loss on the valid rows. Zero-weight rows are
 * omitted entirely. With no valid row the total is the penalty times that invalid
 * count (not `observed.length` when some weights are zero). The penalty is absolute.
 * A non-finite total is `+Infinity`, like any other unusable rank.
 */
function penalizedBatchLoss(
  batch: ScalarBatchResult,
  observed: Float64Array,
  rank: RankLoss
): number {
  let invalid = 0;
  const terms: number[] = [];
  for (let i = 0; i < observed.length; i += 1) {
    const w = rank.weights === undefined ? 1 : rank.weights[i]!;
    if (w === 0) {
      continue;
    }
    if (batch.valid[i] === 0) {
      invalid += 1;
      continue;
    }
    terms.push(namedScalarLossTerm(rank.name, batch.values[i]!, observed[i]!, w));
  }
  if (terms.length === 0 && invalid === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const validLoss = terms.length === 0 ? 0 : pairwiseSum(terms);
  const total = INVALID_ROW_PENALTY * invalid + validLoss;
  return Number.isFinite(total) ? total : Number.POSITIVE_INFINITY;
}

function scoreBatch(batch: ScalarBatchResult, observed: Float64Array, rank: RankLoss): Scored {
  let validRows = 0;
  for (let i = 0; i < batch.valid.length; i += 1) {
    const w = rank.weights === undefined ? 1 : rank.weights[i]!;
    if (w > 0 && batch.valid[i] !== 0) {
      validRows += 1;
    }
  }
  return {
    loss:
      rank.invalidRows === 'penalize'
        ? penalizedBatchLoss(batch, observed, rank)
        : rankScalarBatchLoss(rank.name, batch.values, batch.valid, observed, rank.weights),
    validRows,
  };
}

function scoreOnProblem(
  node: ScalarNode,
  problem: ScalarSearchProblem,
  names: readonly string[],
  parameters: Float64Array,
  rank: RankLoss
): Scored {
  const compiled = compileScalar(node, { variables: problem.variables, parameters: names });
  return scoreBatch(compiled.evaluate(problem.columns, parameters), problem.observed, rank);
}

/** Scores trees, each with the parameters it inherited; the i-th result is for the i-th tree. */
type ScoreTrees = (
  nodes: readonly ScalarNode[],
  inherited: readonly Float64Array[]
) => Promise<Scored[]>;

/**
 * The opt-in dimension filter for one tree: `true` lets the numeric score stand,
 * `false` scores the tree `Infinity` before any numeric result is read.
 */
function dimensionAccepts(
  node: ScalarNode,
  filter: ScalarDimensionFilter,
  parameters: readonly string[]
): boolean {
  if (parameters.length > 0) {
    const result = solveParameterDimensions(node, filter.symbols, filter.target, parameters);
    if ('solved' in result) {
      return true;
    }
    if ('underdetermined' in result) {
      return filter.onUnderdetermined !== 'reject';
    }
    return false;
  }
  const inferred = inferScalarDimension(node, filter.symbols);
  if (!inferred.ok) {
    return false;
  }
  if (filter.equal !== undefined) {
    try {
      return filter.equal(inferred.dimension, filter.target) === true;
    } catch {
      return false;
    }
  }
  return rationalDimensionsEqual(inferred.dimension, filter.target);
}

function scoreOnCallerThread(
  problem: ScalarSearchProblem,
  names: readonly string[],
  rank: RankLoss
): ScoreTrees {
  return async (nodes, inherited) =>
    nodes.map((node, i) => scoreOnProblem(node, problem, names, inherited[i]!, rank));
}

function scoreOnWorkers(
  problem: ScalarSearchProblem,
  names: readonly string[],
  parallel: ScalarPopulationParallelOptions,
  rank: RankLoss
): ScoreTrees {
  return async (nodes, inherited) => {
    const results = await evaluateScalarPopulation({
      variables: problem.variables,
      parameters: names,
      columns: problem.columns,
      items: nodes.map((node, index) => ({ index, node, params: inherited[index]! })),
      parallel,
    });
    return results.map((result) => scoreBatch(result.batch, problem.observed, rank));
  };
}

function individual(
  node: ScalarNode,
  loss: number,
  parameters: Float64Array,
  weights: ScalarComplexityWeights
): EvaluatedIndividual {
  return {
    node,
    key: scalarCanonicalKey(node),
    loss,
    complexity: scalarComplexity(node, weights),
    parameters,
  };
}

/**
 * The scorer for a search: the caller thread without `parallel`, workers with it. The
 * default pool is made through `startPool` the first time workers are needed, so a search
 * over fewer rows than the dispatch threshold never starts a thread.
 */
function scoreTrees(
  problem: ScalarSearchProblem,
  names: readonly string[],
  parallel: ScalarPopulationParallelOptions | undefined,
  startPool: () => WorkerPool,
  rank: RankLoss
): ScoreTrees {
  if (parallel === undefined) {
    return scoreOnCallerThread(problem, names, rank);
  }
  return scoreOnWorkers(
    problem,
    names,
    {
      timeoutMs: resolveParallelTimeout(parallel.timeoutMs),
      pool: parallel.pool ?? {
        execute: <T, R>(data: T, transferables?: Transferable[], timeoutMs?: number) =>
          startPool().execute<T, R>(data, transferables, timeoutMs),
      },
    },
    rank
  );
}

/**
 * Evaluates `nodes` (each with the parameters it inherited), then, with
 * probability `optimizeProbability` and in input order, refits the parameters of
 * a tree on the caller thread. The refit starts from the inherited values. Only the
 * first scoring can run on workers; every random draw is made here, in input order,
 * whichever thread did the scoring.
 */
async function evaluateNodes(
  nodes: readonly ScalarNode[],
  inherited: readonly Float64Array[],
  score: ScoreTrees,
  problem: ScalarSearchProblem,
  names: readonly string[],
  optimizeProbability: number,
  rng: SeededRng,
  rank: RankLoss,
  fit: ScalarFitOptions,
  weights: ScalarComplexityWeights,
  dimensions?: ScalarDimensionFilter
): Promise<EvaluatedIndividual[]> {
  // The dimension check runs before the score, on the tree that will be scored.
  // The batch is still scored whole; the numeric result of a rejected tree is
  // discarded in favor of `Infinity`.
  const dimensionChecks =
    dimensions === undefined
      ? undefined
      : nodes.map((node) => dimensionAccepts(node, dimensions, names));
  const firsts = await score(nodes, inherited);
  const out: EvaluatedIndividual[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    let parameters = inherited[i]!;
    const first = firsts[i]!;
    let loss = first.loss;
    // A dimension failure is the same bucket as a numerical failure: `Infinity`.
    // No refit and no clamp rescore runs — no fit can rescue the dimension — so
    // the random stream draws nothing for a rejected tree.
    const rejected = dimensionChecks !== undefined && !dimensionChecks[i]!;
    if (rejected) {
      loss = Number.POSITIVE_INFINITY;
    }
    if (!rejected) {
      const tryRefit =
        names.length > 0 &&
        rng.next() < optimizeProbability &&
        (first.validRows > 0 || rank.invalidRows === 'penalize');
      if (tryRefit) {
        const rawStart =
          fit.initial !== undefined ? Float64Array.from(fit.initial) : new Float64Array(parameters);
        const fitStart =
          fit.bounds !== undefined ? clampParametersToBounds(rawStart, fit.bounds) : rawStart;
        let fitResult;
        try {
          fitResult = fitScalarParameters(
            node,
            problem.columns,
            problem.observed,
            problem.variables,
            {
              parameters: names,
              initial: fitStart,
              restarts: fit.restarts ?? 2,
              maxIterations: fit.maxIterations ?? 8,
              rng: rng.fork('fit'),
              loss: rank.name,
              weights: rank.weights,
              bounds: fit.bounds,
              algorithm: fit.algorithm,
            }
          );
        } catch (err) {
          if (!(err instanceof RangeError && err.message.includes('no valid rows to fit'))) {
            throw err;
          }
        }
        if (fitResult !== undefined) {
          const fitted = scoreOnProblem(node, problem, names, fitResult.parameters, rank);
          if (fitted.loss < loss) {
            loss = fitted.loss;
            parameters = fitResult.parameters;
          }
        }
      }
      if (fit.bounds !== undefined) {
        parameters = clampParametersToBounds(parameters, fit.bounds);
        loss = scoreOnProblem(node, problem, names, parameters, rank).loss;
      }
    }
    out.push(individual(node, loss, parameters, weights));
  }
  return out;
}

/**
 * @internal Exported for the unit tests, not the package barrel.
 *
 * How often each tree size occurred among the last {@link FREQUENCY_WINDOW}
 * evaluations, shared by every island.
 */
export class ComplexityFrequency {
  private readonly counts = new Map<number, number>();
  private readonly ring: number[] = [];
  private next = 0;

  record(complexity: number): void {
    if (this.ring.length < FREQUENCY_WINDOW) {
      this.ring.push(complexity);
    } else {
      const evicted = this.ring[this.next]!;
      this.counts.set(evicted, this.counts.get(evicted)! - 1);
      this.ring[this.next] = complexity;
      this.next = (this.next + 1) % FREQUENCY_WINDOW;
    }
    this.counts.set(complexity, (this.counts.get(complexity) ?? 0) + 1);
  }

  /** Share of the window with this complexity, in [0, 1]; 0 before anything is recorded. */
  share(complexity: number): number {
    return this.ring.length === 0 ? 0 : (this.counts.get(complexity) ?? 0) / this.ring.length;
  }
}

/**
 * @internal Exported for the unit tests, not the package barrel.
 *
 * Ordering key of a contestant under adaptive parsimony: `log(loss) + scaling * share`,
 * the logarithm of `loss * exp(scaling * share)`. Working in log space keeps the
 * order while `exp(1040 * share)` would overflow to `Infinity` for a share above 0.68
 * and turn a zero loss into `NaN`. A zero loss counts as the smallest positive double so
 * that two perfect trees are still told apart by how crowded their size is.
 */
export function parsimonyKey(ind: EvaluatedIndividual, share: number, scaling: number): number {
  return Math.log(Math.max(ind.loss, Number.MIN_VALUE)) + scaling * share;
}

export function tournamentSelect(
  population: readonly EvaluatedIndividual[],
  rng: SeededRng,
  tournamentSize: number,
  tournamentP: number,
  parsimony?: { readonly frequency: ComplexityFrequency; readonly scaling: number }
): EvaluatedIndividual {
  const n = population.length;
  const k = Math.min(tournamentSize, n);
  const drawn: EvaluatedIndividual[] = [];
  for (let i = 0; i < k; i += 1) {
    drawn.push(population[rng.nextInt(n)]!);
  }
  const contestants =
    parsimony === undefined
      ? drawn.sort((a, b) => compareLoss(a.loss, b.loss))
      : drawn
          .map((ind) => ({
            ind,
            key: parsimonyKey(ind, parsimony.frequency.share(ind.complexity), parsimony.scaling),
          }))
          .sort((a, b) => compareLoss(a.key, b.key))
          .map((entry) => entry.ind);
  let u = rng.next();
  for (let rank = 0; rank < k; rank += 1) {
    const prob = tournamentP * (1 - tournamentP) ** rank;
    if (u < prob) {
      return contestants[rank]!;
    }
    u -= prob;
  }
  return contestants[k - 1]!;
}

/** The best `size` distinct trees (by structure) of `merged`, best first. */
function truncateDistinct(merged: EvaluatedIndividual[], size: number): EvaluatedIndividual[] {
  merged.sort((a, b) => compareLoss(a.loss, b.loss) || a.complexity - b.complexity);
  const seen = new Set<string>();
  const out: EvaluatedIndividual[] = [];
  for (const ind of merged) {
    if (out.length >= size) {
      break;
    }
    if (!seen.has(ind.key)) {
      seen.add(ind.key);
      out.push(ind);
    }
  }
  return out;
}

/** @internal One island's random stream and population. */
export interface Island {
  readonly rng: SeededRng;
  /** Best first after the first generation; the initial deal is in enumeration order. */
  population: EvaluatedIndividual[];
}

/**
 * @internal Exported for the unit tests, not the package barrel.
 *
 * Replaces the worst trees of every island with copies of the best trees of other
 * islands. All donors are read before any island changes, so the order of the islands
 * does not favour one. A tree an island already holds is not migrated into it.
 */
export function migrateIslands(islands: Island[], fractionReplaced: number, rng: SeededRng): void {
  if (islands.length < 2 || fractionReplaced <= 0) {
    return;
  }
  const donors = islands.map((island) => island.population.slice(0, MIGRANT_POOL));
  for (let i = 0; i < islands.length; i += 1) {
    const island = islands[i]!;
    const expected = fractionReplaced * island.population.length;
    let count = Math.floor(expected);
    if (rng.next() < expected - count) {
      count += 1;
    }
    count = Math.min(count, island.population.length);
    const held = new Set(island.population.map((ind) => ind.key));
    const incoming: EvaluatedIndividual[] = [];
    for (let m = 0; m < count; m += 1) {
      const pick = rng.nextInt(islands.length - 1);
      const pool = donors[pick >= i ? pick + 1 : pick]!;
      const migrant = pool[rng.nextInt(pool.length)]!;
      if (!held.has(migrant.key)) {
        held.add(migrant.key);
        incoming.push({ ...migrant, parameters: new Float64Array(migrant.parameters) });
      }
    }
    if (incoming.length > 0) {
      const survivors = island.population.slice(0, island.population.length - incoming.length);
      island.population = truncateDistinct([...survivors, ...incoming], island.population.length);
    }
  }
}

/**
 * Structural grammar check, then `admit` when the caller set it. `scalarGrammarAccepts`
 * does not call `admit`; the search applies it here so seeds and mutation offspring
 * cannot enter when `admit` would reject them. `admit` must be a pure function of
 * the node — the search does not copy it.
 */
function grammarAdmits(grammar: ScalarGrammar, node: ScalarNode): boolean {
  return (
    scalarGrammarAccepts(grammar, node) && (grammar.admit === undefined || grammar.admit(node))
  );
}

/**
 * The `simplify` option applied to one candidate tree. `'off'` returns the tree
 * unchanged. `'constants'` folds numeric-only subtrees; `'algebraic'` runs the
 * expression simplifier. A `ScalarBuildError` or `RangeError` (for example stack
 * overflow on a very deep tree) keeps the unsimplified tree; anything else
 * propagates. The grammar and row-wise evaluation checks happen in
 * {@link acceptCandidate}.
 */
function simplifyCandidate(
  node: ScalarNode,
  mode: ScalarSearchOptions['simplify'],
  recordFallback?: () => void
): ScalarNode {
  if (mode === undefined || mode === 'off') {
    return node;
  }
  if (mode === 'constants') {
    return simplifyConstants(node);
  }
  try {
    return scalarFactories.simplifyScalar(node);
  } catch (err) {
    if (err instanceof ScalarBuildError || err instanceof RangeError) {
      recordFallback?.();
      return node;
    }
    throw err;
  }
}

function positivelyWeightedRow(index: number, weights: Float64Array | undefined): boolean {
  return weights === undefined || weights[index]! > 0;
}

/**
 * True when `original` and `simplified` agree on every positively weighted row:
 * the same valid/invalid pattern and, on valid rows, values within tight tolerance.
 */
function simplifyPreservesRows(
  original: ScalarNode,
  simplified: ScalarNode,
  problem: ScalarSearchProblem,
  names: readonly string[],
  parameters: Float64Array,
  rowWeights: Float64Array | undefined
): boolean {
  if (scalarCanonicalKey(original) === scalarCanonicalKey(simplified)) {
    return true;
  }
  const compileOpts = { variables: problem.variables, parameters: names };
  const batchOrig = compileScalar(original, compileOpts).evaluate(problem.columns, parameters);
  const batchSimp = compileScalar(simplified, compileOpts).evaluate(problem.columns, parameters);
  const n = problem.observed.length;
  for (let i = 0; i < n; i += 1) {
    if (!positivelyWeightedRow(i, rowWeights)) {
      continue;
    }
    const validOrig = batchOrig.valid[i] !== 0;
    const validSimp = batchSimp.valid[i] !== 0;
    if (validOrig !== validSimp) {
      return false;
    }
    if (!validOrig) {
      continue;
    }
    const a = batchOrig.values[i]!;
    const b = batchSimp.values[i]!;
    if (Object.is(a, b)) {
      continue;
    }
    const diff = Math.abs(a - b);
    const scale = Math.max(Math.abs(a), Math.abs(b), 1);
    if (diff > SIMPLIFY_EVAL_ABS_TOL && diff > SIMPLIFY_EVAL_REL_TOL * scale) {
      return false;
    }
  }
  return true;
}

/** Context for {@link acceptCandidate}; one instance per seed or offspring parameter vector. */
interface AcceptContext {
  readonly grammar: ScalarGrammar;
  readonly mode: ScalarSearchOptions['simplify'];
  readonly problem: ScalarSearchProblem;
  readonly names: readonly string[];
  readonly parameters: Float64Array;
  readonly rowWeights: Float64Array | undefined;
  readonly onFallback?: () => void;
}

/**
 * One candidate through simplification and the grammar. `'off'` checks the
 * candidate once. With a mode on, the simplified tree is checked first when its
 * canonical key differs; when the grammar (including `admit`) accepts it and row
 * evaluation matches the original on positively weighted rows, that tree is kept.
 * Otherwise the unsimplified tree is checked and kept if it passes.
 */
function acceptCandidate(candidate: ScalarNode, ctx: AcceptContext): ScalarNode | null {
  const { grammar, mode, problem, names, parameters, rowWeights, onFallback } = ctx;
  if (mode === undefined || mode === 'off') {
    return grammarAdmits(grammar, candidate) ? candidate : null;
  }
  const simplified = simplifyCandidate(candidate, mode, onFallback);
  const sameKey = scalarCanonicalKey(simplified) === scalarCanonicalKey(candidate);
  if (sameKey) {
    if (grammarAdmits(grammar, simplified)) {
      return simplified;
    }
    if (grammarAdmits(grammar, candidate)) {
      if (simplified !== candidate) {
        onFallback?.();
      }
      return candidate;
    }
    return null;
  }
  if (
    grammarAdmits(grammar, simplified) &&
    simplifyPreservesRows(candidate, simplified, problem, names, parameters, rowWeights)
  ) {
    return simplified;
  }
  if (grammarAdmits(grammar, candidate)) {
    onFallback?.();
    return candidate;
  }
  return null;
}

/** Seeds that the grammar (and `admit`, when set) accepts, then enumerated trees. */
function initialTrees(
  grammar: ScalarGrammar,
  seeds: readonly ScalarNode[] | undefined,
  limit: number,
  seedAccept: AcceptContext
): ScalarNode[] {
  const out: ScalarNode[] = [];
  const seen = new Set<string>();
  for (const seed of seeds ?? []) {
    if (out.length >= limit) {
      break;
    }
    const tree = acceptCandidate(seed, seedAccept);
    if (tree === null) {
      continue;
    }
    const key = scalarCanonicalKey(tree);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(tree);
    }
  }
  if (out.length < limit) {
    for (const tree of enumerateScalars(grammar, { maxCandidates: limit + seen.size })) {
      if (out.length >= limit) {
        break;
      }
      const key = scalarCanonicalKey(tree);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(tree);
      }
    }
  }
  return out;
}

/**
 * Best tree per complexity among stored individuals, with at most one stored tree
 * per {@link scalarCanonicalKey}. Same-key dedup runs in {@link HallOfFame.add}:
 * best loss, then smaller complexity, then the one recorded first; complexity
 * weights affect reported complexity only, not which duplicate survives.
 */
class HallOfFame {
  private readonly byComplexity = new Map<number, EvaluatedIndividual>();
  private readonly byKey = new Map<string, EvaluatedIndividual>();

  /** Whether `candidate` should replace `prev` as the survivor for their shared key. */
  private sameKeySurvivor(candidate: EvaluatedIndividual, prev: EvaluatedIndividual): boolean {
    if (candidate.loss < prev.loss) {
      return true;
    }
    if (candidate.loss > prev.loss) {
      return false;
    }
    if (candidate.complexity < prev.complexity) {
      return true;
    }
    if (candidate.complexity > prev.complexity) {
      return false;
    }
    return false;
  }

  private evictFromComplexity(ind: EvaluatedIndividual): void {
    const slot = this.byComplexity.get(ind.complexity);
    if (slot === ind) {
      this.byComplexity.delete(ind.complexity);
    }
  }

  add(ind: EvaluatedIndividual): void {
    if (!Number.isFinite(ind.loss)) {
      return;
    }
    const prevKey = this.byKey.get(ind.key);
    if (prevKey !== undefined && !this.sameKeySurvivor(ind, prevKey)) {
      return;
    }
    if (prevKey !== undefined) {
      this.evictFromComplexity(prevKey);
    }
    this.byKey.set(ind.key, ind);
    const prevComplexity = this.byComplexity.get(ind.complexity);
    if (prevComplexity === undefined || ind.loss < prevComplexity.loss) {
      this.byComplexity.set(ind.complexity, ind);
    }
  }

  front(): { front: ScoredCandidate<ScalarNode>[]; fittedParameters: Float64Array[] } {
    const rows = [...this.byComplexity.values()].map((ind) => ({
      loss: ind.loss,
      complexity: ind.complexity,
      item: ind.node,
    }));
    const front = scoreFront(paretoFront(rows));
    const byNode = new Map<ScalarNode, EvaluatedIndividual>();
    for (const ind of this.byComplexity.values()) {
      byNode.set(ind.node, ind);
    }
    const fittedParameters = front.map((row) => new Float64Array(byNode.get(row.item)!.parameters));
    return { front, fittedParameters };
  }
}

function pickSelected(
  front: ScoredCandidate<ScalarNode>[],
  mode: ScalarSearchOptions['modelSelection'],
  bestLossFactor: number | undefined
): ScoredCandidate<ScalarNode> | undefined {
  if (mode === undefined || front.length === 0) {
    return undefined;
  }
  return selectFrontModel(front, mode, { bestLossFactor });
}

/**
 * Symbolic regression over scalar expression trees.
 *
 * The generator yields one {@link SearchProgress} after the initial population
 * and one after every generation, and returns a {@link ScalarSearchResult}.
 * Evaluations never exceed `maxEvaluations`. `options.rng` is not advanced, so two
 * runs with the same inputs and seed agree bit for bit. When `grammar.admit` is
 * set it binds seeds and mutation offspring (`scalarGrammarAccepts`, then `admit`).
 * A rejected child is a failed attempt; a rejected seed is skipped. `admit` must
 * be a pure function of the node — a predicate that reads a clock or a random
 * stream makes the run unreproducible. `admitMonotone` is left to enumeration.
 * Ranking and refit share `loss` (`'l2'` by default) and optional `rowWeights`.
 * `invalidRows` defaults to `'reject'` (`+Infinity` on any invalid row); `'penalize'`
 * adds {@link INVALID_ROW_PENALTY} per positively weighted invalid row on top of the
 * valid-row loss (absolute, not target-scaled). Under `'penalize'` the advisory refit
 * still runs when every weighted row is invalid; refit acceptance uses the ranker on
 * both sides. `complexityWeights` weighs the nodes of the complexity the hall, the
 * truncation tie-break, and adaptive parsimony use; omitted, it is today's size.
 * When set, weights are copied into a frozen snapshot before the first yield (plain
 * data objects only; non-enumerable keys and accessors are rejected). Record keys
 * use lowered call names (`ln` → `log`); unknown keys are ignored by
 * `scalarComplexity`. `grammar.maxSize` counts raw nodes, not weighted complexity;
 * `Math.round` on the sum can map distinct trees to one hall slot. The hall keeps one
 * tree per canonical key at add time (best loss, then complexity, then first recorded);
 * elitist truncation already keeps one tree per key in the population with the same
 * loss-first order. Weights change reported complexity only, not which duplicate survives.
 * `fit`
 * forwards `restarts` (default 2), `maxIterations` (default 8), `bounds`,
 * `algorithm`, and `initial` (default the inherited vector) to the fitter; a bad
 * bound or length throws before the first yield. Omitted fields are today's call.
 * `crossoverProbability` defaults to 0 (no coin). A positive probability draws
 * the coin on the island stream and, on success, a second tournament parent.
 * `simplify` defaults to `'off'` (no simplifier runs). `'constants'` folds
 * numeric-only subtrees and `'algebraic'` runs the expression simplifier, once
 * per seed and per bred offspring, before the grammar check and the score; a
 * `ScalarBuildError`, `RangeError`, grammar rejection (including `admit`), or
 * row-wise evaluation mismatch keeps the unsimplified tree. Enumerated trees are
 * not simplified. Simplification draws no random numbers, but different accepted
 * trees can change mutation outcomes, so a run with `simplify` on may diverge from
 * `'off'`; two runs that share the same mode and seed still match. Progress event
 * count stays budget-driven. `dimensions` (opt-in) checks the SI dimension of the
 * tree that will be scored — after the grammar check, before the score — against
 * `target`: a violation or an `inconsistent` solve scores `Infinity` (still an
 * evaluation, never in the hall), an underdetermined solve is kept by default or
 * rejected with `'reject'`, and the check draws no random numbers. `signal`
 * (opt-in) is checked before the initial population and between generations, never
 * mid-draw: already aborted before the first yield the result carries an empty
 * front and `evaluations: 0`; aborted after a yield the last progress is returned
 * as the result, both with `stopReason: 'cancelled'`. `earlyStop` (opt-in) ends
 * the run with `stopReason: 'early-stop'` once the best finite hall loss has been
 * `<= loss` for `generations` consecutive generations (hall after the generation,
 * initial population included).
 *
 * @throws {RangeError} A malformed problem or option, or a grammar that admits no tree.
 */
export async function* searchScalars(
  problem: ScalarSearchProblem,
  options: ScalarSearchOptions
): AsyncGenerator<SearchProgress, ScalarSearchResult> {
  const populationSize = options.populationSize ?? DEFAULT_POPULATION_SIZE;
  const tournamentSize = options.tournamentSize ?? DEFAULT_TOURNAMENT_SIZE;
  const tournamentP = options.tournamentP ?? DEFAULT_TOURNAMENT_P;
  const optimizeProbability = options.optimizeProbability ?? DEFAULT_OPTIMIZE_PROBABILITY;
  const crossoverProbability = options.crossoverProbability ?? DEFAULT_CROSSOVER_PROBABILITY;
  const simplifyMode = options.simplify ?? 'off';
  assertSearchInputs(
    problem,
    options,
    populationSize,
    tournamentSize,
    tournamentP,
    optimizeProbability,
    crossoverProbability
  );
  const earlyStop =
    options.earlyStop === undefined
      ? undefined
      : Object.freeze({
          loss: options.earlyStop.loss,
          generations: options.earlyStop.generations,
        });
  const names = paramNames(problem, options.grammar);
  if (options.fit !== undefined && !isPlainObject(options.fit)) {
    throw new RangeError(`searchScalars: fit must be a plain object, got ${String(options.fit)}`);
  }
  const fit: ScalarFitOptions = options.fit ?? {};
  const complexityWeights: ScalarComplexityWeights =
    options.complexityWeights === undefined
      ? {}
      : normalizeComplexityWeights(options.complexityWeights, options.grammar.maxSize);
  const rank: RankLoss = {
    name: options.loss ?? 'l2',
    weights: options.rowWeights,
    invalidRows: options.invalidRows ?? 'reject',
  };
  assertFitOptions(fit, names.length, rank.name);
  const dimensionsFilter =
    options.dimensions === undefined ? undefined : normalizeDimensionFilter(options.dimensions);
  const budget = Math.floor(Math.min(options.maxEvaluations, options.maxCandidates ?? Infinity));
  const candidatesBind =
    options.maxCandidates !== undefined && options.maxCandidates < options.maxEvaluations;
  let ownedPool: WorkerPool | undefined;
  const score = scoreTrees(
    problem,
    names,
    options.parallel,
    () => {
      ownedPool ??= createScalarBatchPool();
      return ownedPool;
    },
    rank
  );
  try {
    const mutate = weightedMutation();
    const populations = options.populations ?? 1;
    const multiIsland = populations > 1;
    const annealing = options.annealing ?? multiIsland;
    const parsimony =
      (options.adaptiveParsimony ?? multiIsland)
        ? {
            frequency: new ComplexityFrequency(),
            scaling: options.adaptiveParsimonyScaling ?? DEFAULT_PARSIMONY_SCALING,
          }
        : undefined;
    const frequencyRecordTiming = options.frequencyRecordTiming ?? 'island-boundary';
    const fractionReplaced = options.fractionReplaced ?? DEFAULT_FRACTION_REPLACED;
    const migrationRng = options.rng.fork('migration');
    let temperature = annealing ? (options.initialTemperature ?? DEFAULT_INITIAL_TEMPERATURE) : 1;

    let evaluations = 0;
    let simplifyFallbacks = 0;
    const hallOfFame = new HallOfFame();

    // SR-15: the best finite loss the hall has stored (hall.add skips non-finite
    // losses) and the run of consecutive generations whose hall best is within the
    // early-stop bound. The best can only improve, so the streak resets only while
    // the bound has not been reached yet.
    let bestLoss = Number.POSITIVE_INFINITY;
    let earlyStreak = 0;
    const noteLosses = (individuals: readonly EvaluatedIndividual[]): void => {
      for (const ind of individuals) {
        if (ind.loss < bestLoss) {
          bestLoss = ind.loss;
        }
      }
    };
    const noteEarlyStop = (): void => {
      if (earlyStop === undefined) {
        return;
      }
      if (bestLoss <= earlyStop.loss) {
        earlyStreak += 1;
      } else {
        earlyStreak = 0;
      }
    };
    const betweenGenerations = (): ScalarSearchStopReason | null => {
      // When both fire on the same check, cancellation wins over early stop.
      if (options.signal?.aborted) {
        return 'cancelled';
      }
      if (earlyStop !== undefined && earlyStreak >= earlyStop.generations) {
        return 'early-stop';
      }
      return null;
    };
    const resultWith = (stopReason: ScalarSearchStopReason): ScalarSearchResult => {
      const { front, fittedParameters } = hallOfFame.front();
      return {
        front,
        parameterNames: names,
        fittedParameters,
        stopReason,
        evaluations,
        seed: options.rng.seed,
        selected: pickSelected(front, options.modelSelection, options.bestLossFactor),
        simplifyFallbacks,
      };
    };

    const seedAccept: AcceptContext = {
      grammar: options.grammar,
      mode: simplifyMode,
      problem,
      names,
      parameters: defaultParameters(names.length),
      rowWeights: rank.weights,
      onFallback:
        simplifyMode === 'off' || simplifyMode === undefined
          ? undefined
          : () => {
              simplifyFallbacks += 1;
            },
    };

    // The signal is checked before the initial population, so an already-aborted
    // run does not enumerate, score, or start a worker: the result carries the
    // empty hall (front []) and zero evaluations.
    if (options.signal?.aborted) {
      return resultWith('cancelled');
    }

    const trees = initialTrees(
      options.grammar,
      options.seeds,
      Math.min(populationSize * populations, budget),
      seedAccept
    );
    if (trees.length === 0 && budget >= 1) {
      throw new RangeError('searchScalars: the grammar admits no tree');
    }

    // The initial trees are dealt round-robin, so every island gets a share of the small
    // ones. An island that would get none (fewer trees than islands) is dropped.
    const islands: Island[] = [];
    for (let index = 0; index < populations; index += 1) {
      const mine = trees.filter((_, t) => t % populations === index);
      if (mine.length === 0) {
        continue;
      }
      // One island draws from the 'population' stream, which is what makes
      // `populations: 1` the same search as M13a.
      const rng = options.rng.fork(multiIsland ? `island:${index}` : 'population');
      const population = await evaluateNodes(
        mine,
        mine.map(() => defaultParameters(names.length)),
        score,
        problem,
        names,
        optimizeProbability,
        rng,
        rank,
        fit,
        complexityWeights,
        dimensionsFilter
      );
      evaluations += population.length;
      for (const ind of population) {
        hallOfFame.add(ind);
        parsimony?.frequency.record(ind.complexity);
      }
      noteLosses(population);
      islands.push({ rng, population });
    }
    noteEarlyStop();

    const report = (): SearchProgress => {
      const { front, fittedParameters } = hallOfFame.front();
      return {
        status: 'fitted',
        evaluations,
        front,
        parameterNames: names,
        fittedParameters,
        selected: pickSelected(front, options.modelSelection, options.bestLossFactor),
      };
    };

    yield report();

    // Between-generation checks: an abort or a met early-stop bound ends the run
    // on the progress just yielded; no further generation starts.
    const firstStop = betweenGenerations();
    if (firstStop !== null) {
      return resultWith(firstStop);
    }

    while (evaluations < budget) {
      const mutationCtx: ScalarMutationContext = {
        grammar: options.grammar,
        perturbationFactor: options.perturbationFactor ?? DEFAULT_PERTURBATION_FACTOR,
        temperature,
      };
      // The offspring counts depend only on the budget arithmetic, never on a score:
      // every island takes `populationSize` offspring until the budget runs out. They
      // are fixed up front so every island can breed here, in island-index order, and
      // then score at the same time. Each island breeds from its own population with
      // its own rng, so the draws match the sequential schedule.
      const batches: {
        island: Island;
        nodes: ScalarNode[];
        inherited: Float64Array[];
        pendingComplexities: number[];
      }[] = [];
      let remaining = budget - evaluations;
      for (const island of islands) {
        const offspringCount = Math.min(populationSize, remaining);
        if (offspringCount <= 0) {
          break;
        }
        remaining -= offspringCount;
        const nodes: ScalarNode[] = [];
        const inherited: Float64Array[] = [];
        const pending: number[] = [];
        for (let i = 0; i < offspringCount; i += 1) {
          const parent = tournamentSelect(
            island.population,
            island.rng,
            tournamentSize,
            tournamentP,
            parsimony
          );
          let child: ScalarNode | null = null;
          // Probability 0 skips the coin so the island stream matches today's
          // mutation-only order. A positive probability draws once per offspring.
          if (crossoverProbability > 0 && island.rng.next() < crossoverProbability) {
            const mate = tournamentSelect(
              island.population,
              island.rng,
              tournamentSize,
              tournamentP,
              parsimony
            );
            const crossed = crossoverSubtrees(parent.node, mate.node, island.rng, mutationCtx);
            if (crossed !== null) {
              child = acceptCandidate(crossed, {
                ...seedAccept,
                parameters: parent.parameters,
              });
            }
          }
          for (let attempt = 0; attempt < MUTATION_ATTEMPTS && child === null; attempt += 1) {
            const candidate = mutate(parent.node, island.rng, mutationCtx);
            if (candidate !== null) {
              child = acceptCandidate(candidate, {
                ...seedAccept,
                parameters: parent.parameters,
              });
            }
          }
          nodes.push(child ?? parent.node);
          inherited.push(new Float64Array(parent.parameters));
          if (parsimony !== undefined) {
            const complexity = scalarComplexity(nodes[nodes.length - 1]!, complexityWeights);
            if (frequencyRecordTiming === 'per-offspring') {
              parsimony.frequency.record(complexity);
            } else {
              pending.push(complexity);
            }
          }
        }
        if (
          parsimony !== undefined &&
          frequencyRecordTiming === 'island-boundary' &&
          pending.length > 0
        ) {
          // Staged flush at the island boundary: the sequential schedule records an
          // island's offspring complexities only after that island finished breeding,
          // so its own later tournaments must not see them.
          for (const complexity of pending) {
            parsimony.frequency.record(complexity);
          }
        }
        batches.push({ island, nodes, inherited, pendingComplexities: pending });
      }
      // The islands' score calls overlap inside this process; each island keeps its
      // own rng, so the refit draws stay on the island's own stream.
      const scored = await Promise.all(
        batches.map((batch) =>
          evaluateNodes(
            batch.nodes,
            batch.inherited,
            score,
            problem,
            names,
            optimizeProbability,
            batch.island.rng,
            rank,
            fit,
            complexityWeights,
            dimensionsFilter
          )
        )
      );
      // One island at a time, in island-index order: hall updates and population
      // replacement. That order matches the sequential schedule for determinism;
      // the hall keeps one row per canonical key at add time, so equal losses across
      // islands rarely surface through front().
      for (let b = 0; b < batches.length; b += 1) {
        const offspring = scored[b]!;
        evaluations += offspring.length;
        for (const ind of offspring) {
          hallOfFame.add(ind);
          noteLosses([ind]);
        }
        if (parsimony !== undefined && frequencyRecordTiming === 'after-merge') {
          for (const complexity of batches[b]!.pendingComplexities) {
            parsimony.frequency.record(complexity);
          }
        }
        batches[b]!.island.population = truncateDistinct(
          [...batches[b]!.island.population, ...offspring],
          populationSize
        );
      }
      noteEarlyStop();
      // After the last evaluation nothing breeds again, so migrating would change nothing.
      if (evaluations < budget) {
        migrateIslands(islands, fractionReplaced, migrationRng);
      }
      if (annealing) {
        temperature *= TEMPERATURE_DECAY;
      }

      yield report();
      await Promise.resolve();
      const stop = betweenGenerations();
      if (stop !== null) {
        return resultWith(stop);
      }
    }

    const last = report();
    return {
      front: last.front,
      parameterNames: names,
      fittedParameters: last.fittedParameters,
      stopReason: candidatesBind ? 'max-candidates' : 'max-evaluations',
      evaluations,
      seed: options.rng.seed,
      selected: last.selected,
      simplifyFallbacks,
    };
  } finally {
    // A generator that is closed early lands here too, so no worker outlives its search.
    await ownedPool?.terminate();
  }
}

/**
 * Problem input for {@link runScalarSearch}: like {@link ScalarSearchProblem},
 * but `columns` may be a record keyed by variable name instead of the aligned
 * array `searchScalars` requires.
 */
export interface ScalarSearchRunProblem extends Omit<ScalarSearchProblem, 'columns'> {
  /**
   * One column per variable. Either the aligned array `searchScalars` takes, or a
   * record keyed by the names in `variables`; the wrapper reads a record in
   * `variables` order to build that array. A name without an entry throws
   * `RangeError`. A column whose length differs from `observed.length` throws
   * `RangeError` from `searchScalars` as usual.
   */
  readonly columns: readonly Float64Array[] | Readonly<Record<string, Float64Array>>;
}

/**
 * Options for {@link runScalarSearch}: {@link ScalarSearchOptions} with `rng`
 * optional — exactly one of `seed` and `rng` must be set.
 */
export type ScalarSearchRunOptions = Omit<ScalarSearchOptions, 'rng'> & {
  /** Seed for a fresh {@link createSeededRng}; required when `rng` is omitted. */
  readonly seed?: number;
  /** Caller-owned random stream; required when `seed` is omitted, never advanced. */
  readonly rng?: SeededRng;
};

/**
 * Consume {@link searchScalars} to its final {@link ScalarSearchResult} (SR-16).
 * A thin wrapper: when `seed` is set and `rng` is omitted it builds
 * {@link createSeededRng}(seed) and passes that; when both are set, or neither
 * is, it throws `RangeError`. A `columns` record is read in `variables` order.
 * It does not reimplement any search behavior, so every documented default and
 * the seed-7 pin hold unchanged.
 *
 * @throws {RangeError} `seed` and `rng` are both set, neither is set, a variable
 * has no entry in `columns`, `bestLossFactor` is non-finite, or any check
 * {@link searchScalars} itself performs fails.
 */
export async function runScalarSearch(
  problem: ScalarSearchRunProblem,
  options: ScalarSearchRunOptions
): Promise<ScalarSearchResult> {
  const { seed, rng } = options;
  if (seed !== undefined && rng !== undefined) {
    throw new RangeError('runScalarSearch: pass seed or rng, not both');
  }
  let resolvedRng: SeededRng;
  if (rng !== undefined) {
    resolvedRng = rng;
  } else if (seed !== undefined) {
    resolvedRng = createSeededRng(seed);
  } else {
    throw new RangeError('runScalarSearch: one of seed or rng is required');
  }
  if (options.bestLossFactor !== undefined && !Number.isFinite(options.bestLossFactor)) {
    throw new RangeError(
      `runScalarSearch: bestLossFactor must be a finite number, got ${String(options.bestLossFactor)}`
    );
  }
  let columns: readonly Float64Array[];
  if (Array.isArray(problem.columns)) {
    columns = problem.columns as readonly Float64Array[];
  } else {
    const record = problem.columns as Readonly<Record<string, Float64Array>>;
    columns = problem.variables.map((name) => {
      const column = record[name];
      if (!(column instanceof Float64Array)) {
        throw new RangeError(`runScalarSearch: columns has no Float64Array for variable '${name}'`);
      }
      return column;
    });
  }
  const { seed: _seed, rng: _rng, ...rest } = options;
  const iterator = searchScalars({ ...problem, columns }, { ...rest, rng: resolvedRng });
  let next = await iterator.next();
  while (!next.done) {
    next = await iterator.next();
  }
  return next.value;
}
