/**
 * PySR-style evolutionary search over {@link ScalarNode} trees (M13).
 *
 * `populations` islands each evolve by tournament selection and
 * {@link weightedMutation}. Each generation breeds `populationSize` offspring per
 * island from tournament winners, evaluates them in one batch, and keeps the best
 * `populationSize` distinct trees of parents and offspring (elitist truncation, not
 * PySR's age-based replacement). After every generation the islands exchange their
 * best trees (migration). A hall of fame shared by every island keeps the best tree
 * per complexity; its Pareto front is reported through {@link paretoFront} and
 * {@link scoreFront}.
 *
 * @packageDocumentation
 */

import { pairwiseSum, type SeededRng } from '@danielsimonjr/mathts-core';
import {
  enumerateScalars,
  scalarCanonicalKey,
  scalarComplexity,
  scalarGrammarAccepts,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { fitScalarParameters } from './fit-scalar.js';
import { paretoFront, scoreFront, selectFrontModel, type ScoredCandidate } from './pareto-front.js';
import { compileScalar } from './scalar-compile.js';
import { weightedMutation, type ScalarMutationContext } from './scalar-mutate.js';

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
  /** Cap on tree evaluations, the initial population included. */
  readonly maxEvaluations: number;
  /** Second cap on tree evaluations, reported as `'max-candidates'`. */
  readonly maxCandidates?: number;
  /** Trees injected into the initial population (PySR `guesses`); the grammar filters them. */
  readonly seeds?: readonly ScalarNode[];
  /** Constant-perturbation scale handed to the mutations. Default 0.25. */
  readonly perturbationFactor?: number;
  /** How `selected` is chosen from the front. Omitted: no selection. */
  readonly modelSelection?: 'accuracy' | 'score' | 'best';
  /**
   * Independent islands, each with `populationSize` trees and its own random stream
   * (`rng.fork('island:' + index)`). Default 1, which draws from `rng.fork('population')`.
   * Evaluations are counted across all islands.
   */
  readonly populations?: number;
  /**
   * Expected share of each island replaced by another island's best trees after every
   * generation, in [0, 1]. The count is the expectation rounded at random. Default 0.00036
   * (PySR `fraction_replaced`).
   */
  readonly fractionReplaced?: number;
  /**
   * Shrink the constant perturbation scale over the run: the mutation temperature starts
   * at `initialTemperature` and is multiplied by 0.995 after every generation. Default:
   * on when `populations > 1`, so a single population stays the M13a search.
   */
  readonly annealing?: boolean;
  /** Starting temperature when `annealing` is on. Default 3.17 (PySR `alpha`). */
  readonly initialTemperature?: number;
  /**
   * Rank tournament contestants by `loss * exp(adaptiveParsimonyScaling * f)`, where `f`
   * is the share of recent evaluations that had the contestant's complexity. Crowded
   * sizes lose, so the population explores every size. Default: on when `populations > 1`.
   */
  readonly adaptiveParsimony?: boolean;
  /** Strength of the adaptive-parsimony penalty. Default 1040 (PySR). */
  readonly adaptiveParsimonyScaling?: number;
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

export type ScalarSearchStopReason = 'max-evaluations' | 'max-candidates';

/** Final value of the async generator returned by {@link searchScalars}. */
export interface ScalarSearchResult {
  readonly front: ScoredCandidate<ScalarNode>[];
  readonly parameterNames: readonly string[];
  readonly fittedParameters: Float64Array[];
  readonly stopReason: ScalarSearchStopReason;
  readonly evaluations: number;
  readonly seed: number;
  readonly selected?: ScoredCandidate<ScalarNode>;
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
const DEFAULT_PERTURBATION_FACTOR = 0.25;
const DEFAULT_FRACTION_REPLACED = 0.00036;
const DEFAULT_INITIAL_TEMPERATURE = 3.17;
const DEFAULT_PARSIMONY_SCALING = 1040;

/** Tries a mutation this often before an offspring falls back to a copy of its parent. */
const MUTATION_ATTEMPTS = 10;

/** The mutation temperature is multiplied by this after every generation. */
const TEMPERATURE_DECAY = 0.995;

/** Migrants are drawn from the best this-many trees of the donor island (PySR `topn`). */
const MIGRANT_POOL = 12;

/** Evaluations that the complexity frequencies remember (PySR's running window). */
const FREQUENCY_WINDOW = 100_000;

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

function assertSearchInputs(
  problem: ScalarSearchProblem,
  options: ScalarSearchOptions,
  populationSize: number,
  tournamentSize: number,
  tournamentP: number,
  optimizeProbability: number
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
}

function defaultParameters(n: number): Float64Array {
  return new Float64Array(n).fill(1);
}

/** Order for losses: smaller first, `Infinity` last. Losses are never `NaN` here. */
function compareLoss(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Sum of squared errors, or `Infinity` when any row is invalid or the sum is not
 * finite. A candidate that cannot be evaluated on the whole data set never ranks
 * above one that can, whatever the scale of `observed`.
 */
function sumSquaredLoss(values: Float64Array, valid: Uint8Array, observed: Float64Array): number {
  const terms = new Float64Array(observed.length);
  for (let i = 0; i < observed.length; i += 1) {
    if (valid[i] === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const d = values[i]! - observed[i]!;
    terms[i] = d * d;
  }
  const loss = pairwiseSum(terms);
  return Number.isFinite(loss) ? loss : Number.POSITIVE_INFINITY;
}

interface Scored {
  readonly loss: number;
  readonly validRows: number;
}

function scoreOnProblem(
  node: ScalarNode,
  problem: ScalarSearchProblem,
  names: readonly string[],
  parameters: Float64Array
): Scored {
  const compiled = compileScalar(node, { variables: problem.variables, parameters: names });
  const batch = compiled.evaluate(problem.columns, parameters);
  let validRows = 0;
  for (let i = 0; i < batch.valid.length; i += 1) {
    validRows += batch.valid[i]!;
  }
  return { loss: sumSquaredLoss(batch.values, batch.valid, problem.observed), validRows };
}

function individual(node: ScalarNode, loss: number, parameters: Float64Array): EvaluatedIndividual {
  return {
    node,
    key: scalarCanonicalKey(node),
    loss,
    complexity: scalarComplexity(node),
    parameters,
  };
}

/**
 * Evaluates `nodes` (each with the parameters it inherited), then, with
 * probability `optimizeProbability` and in input order, refits the parameters of
 * a tree on the caller thread. The refit starts from the inherited values.
 */
function evaluateNodes(
  nodes: readonly ScalarNode[],
  inherited: readonly Float64Array[],
  problem: ScalarSearchProblem,
  names: readonly string[],
  optimizeProbability: number,
  rng: SeededRng
): EvaluatedIndividual[] {
  const out: EvaluatedIndividual[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    let parameters = inherited[i]!;
    const first = scoreOnProblem(node, problem, names, parameters);
    let loss = first.loss;
    if (names.length > 0 && first.validRows > 0 && rng.next() < optimizeProbability) {
      const fit = fitScalarParameters(node, problem.columns, problem.observed, problem.variables, {
        parameters: names,
        initial: parameters,
        restarts: 2,
        maxIterations: 8,
        rng: rng.fork('fit'),
      });
      const fitted = scoreOnProblem(node, problem, names, fit.parameters);
      if (fitted.loss < loss) {
        loss = fitted.loss;
        parameters = fit.parameters;
      }
    }
    out.push(individual(node, loss, parameters));
  }
  return out;
}

/**
 * @internal Exported for the unit tests, not the package barrel.
 *
 * How often each tree size occurred among the last {@link FREQUENCY_WINDOW}
 * evaluations, shared by every island (PySR's `RunningSearchStatistics`).
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
 * the logarithm of PySR's `loss * exp(scaling * share)`. Working in log space keeps the
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

/** Seeds that the grammar accepts, then enumerated trees, up to `limit` distinct trees. */
function initialTrees(
  grammar: ScalarGrammar,
  seeds: readonly ScalarNode[] | undefined,
  limit: number
): ScalarNode[] {
  const out: ScalarNode[] = [];
  const seen = new Set<string>();
  for (const seed of seeds ?? []) {
    if (out.length >= limit) {
      break;
    }
    const key = scalarCanonicalKey(seed);
    if (!seen.has(key) && scalarGrammarAccepts(grammar, seed)) {
      seen.add(key);
      out.push(seed);
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

/** Best tree per complexity; the Pareto front is taken from these. */
class HallOfFame {
  private readonly byComplexity = new Map<number, EvaluatedIndividual>();

  add(ind: EvaluatedIndividual): void {
    if (!Number.isFinite(ind.loss)) {
      return;
    }
    const prev = this.byComplexity.get(ind.complexity);
    if (prev === undefined || ind.loss < prev.loss) {
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
  mode: ScalarSearchOptions['modelSelection']
): ScoredCandidate<ScalarNode> | undefined {
  if (mode === undefined || front.length === 0) {
    return undefined;
  }
  return selectFrontModel(front, mode);
}

/**
 * Symbolic regression over scalar expression trees.
 *
 * The generator yields one {@link SearchProgress} after the initial population
 * and one after every generation, and returns a {@link ScalarSearchResult}.
 * Evaluations never exceed `maxEvaluations`. `options.rng` is not advanced, so two
 * runs with the same inputs and seed agree bit for bit.
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
  assertSearchInputs(
    problem,
    options,
    populationSize,
    tournamentSize,
    tournamentP,
    optimizeProbability
  );
  const names = paramNames(problem, options.grammar);
  const budget = Math.floor(Math.min(options.maxEvaluations, options.maxCandidates ?? Infinity));
  const candidatesBind =
    options.maxCandidates !== undefined && options.maxCandidates < options.maxEvaluations;
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
  const fractionReplaced = options.fractionReplaced ?? DEFAULT_FRACTION_REPLACED;
  const migrationRng = options.rng.fork('migration');
  let temperature = annealing ? (options.initialTemperature ?? DEFAULT_INITIAL_TEMPERATURE) : 1;

  let evaluations = 0;
  const hallOfFame = new HallOfFame();

  const trees = initialTrees(
    options.grammar,
    options.seeds,
    Math.min(populationSize * populations, budget)
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
    const population = evaluateNodes(
      mine,
      mine.map(() => defaultParameters(names.length)),
      problem,
      names,
      optimizeProbability,
      rng
    );
    evaluations += population.length;
    for (const ind of population) {
      hallOfFame.add(ind);
      parsimony?.frequency.record(ind.complexity);
    }
    islands.push({ rng, population });
  }

  const report = (): SearchProgress => {
    const { front, fittedParameters } = hallOfFame.front();
    return {
      status: 'fitted',
      evaluations,
      front,
      parameterNames: names,
      fittedParameters,
      selected: pickSelected(front, options.modelSelection),
    };
  };

  yield report();

  while (evaluations < budget) {
    const mutationCtx: ScalarMutationContext = {
      grammar: options.grammar,
      perturbationFactor: options.perturbationFactor ?? DEFAULT_PERTURBATION_FACTOR,
      temperature,
    };
    for (const island of islands) {
      const offspringCount = Math.min(populationSize, budget - evaluations);
      if (offspringCount <= 0) {
        break;
      }
      const nodes: ScalarNode[] = [];
      const inherited: Float64Array[] = [];
      for (let i = 0; i < offspringCount; i += 1) {
        const parent = tournamentSelect(
          island.population,
          island.rng,
          tournamentSize,
          tournamentP,
          parsimony
        );
        let child: ScalarNode | null = null;
        for (let attempt = 0; attempt < MUTATION_ATTEMPTS && child === null; attempt += 1) {
          child = mutate(parent.node, island.rng, mutationCtx);
        }
        nodes.push(child ?? parent.node);
        inherited.push(new Float64Array(parent.parameters));
      }
      const offspring = evaluateNodes(
        nodes,
        inherited,
        problem,
        names,
        optimizeProbability,
        island.rng
      );
      evaluations += offspring.length;
      for (const ind of offspring) {
        hallOfFame.add(ind);
        parsimony?.frequency.record(ind.complexity);
      }
      island.population = truncateDistinct([...island.population, ...offspring], populationSize);
    }
    // After the last evaluation nothing breeds again, so migrating would change nothing.
    if (evaluations < budget) {
      migrateIslands(islands, fractionReplaced, migrationRng);
    }
    if (annealing) {
      temperature *= TEMPERATURE_DECAY;
    }

    yield report();
    await Promise.resolve();
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
  };
}
