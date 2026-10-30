/**
 * PySR-style evolutionary search over {@link ScalarNode} trees (M13).
 *
 * One population evolves by tournament selection and {@link weightedMutation}.
 * Each generation breeds `populationSize` offspring from tournament winners,
 * evaluates them in one batch, and keeps the best `populationSize` distinct trees
 * of parents and offspring (elitist truncation, not PySR's age-based replacement).
 * A hall of fame keeps the best tree per complexity; its Pareto front is reported
 * through {@link paretoFront} and {@link scoreFront}.
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
  /** Ignored until islands land (M13b). */
  readonly populations?: number;
  /** Ignored until islands land (M13b). */
  readonly fractionReplaced?: number;
  /** Ignored until islands land (M13b). */
  readonly annealing?: boolean;
  /** Ignored until islands land (M13b). */
  readonly initialTemperature?: number;
  /** Ignored until islands land (M13b). */
  readonly adaptiveParsimony?: boolean;
  /** Ignored until islands land (M13b). */
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

interface EvaluatedIndividual {
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

/** Tries a mutation this often before an offspring falls back to a copy of its parent. */
const MUTATION_ATTEMPTS = 10;

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

function tournamentSelect(
  population: readonly EvaluatedIndividual[],
  rng: SeededRng,
  tournamentSize: number,
  tournamentP: number
): EvaluatedIndividual {
  const n = population.length;
  const k = Math.min(tournamentSize, n);
  const contestants: EvaluatedIndividual[] = [];
  for (let i = 0; i < k; i += 1) {
    contestants.push(population[rng.nextInt(n)]!);
  }
  contestants.sort((a, b) => compareLoss(a.loss, b.loss));
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
  const rng = options.rng.fork('population');
  const mutationCtx: ScalarMutationContext = {
    grammar: options.grammar,
    perturbationFactor: options.perturbationFactor ?? DEFAULT_PERTURBATION_FACTOR,
    temperature: 1,
  };

  let evaluations = 0;
  const hallOfFame = new HallOfFame();

  const trees = initialTrees(options.grammar, options.seeds, Math.min(populationSize, budget));
  if (trees.length === 0 && budget >= 1) {
    throw new RangeError('searchScalars: the grammar admits no tree');
  }
  let population = evaluateNodes(
    trees,
    trees.map(() => defaultParameters(names.length)),
    problem,
    names,
    optimizeProbability,
    rng
  );
  evaluations += population.length;
  for (const ind of population) {
    hallOfFame.add(ind);
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
    const offspringCount = Math.min(populationSize, budget - evaluations);
    const nodes: ScalarNode[] = [];
    const inherited: Float64Array[] = [];
    for (let i = 0; i < offspringCount; i += 1) {
      const parent = tournamentSelect(population, rng, tournamentSize, tournamentP);
      let child: ScalarNode | null = null;
      for (let attempt = 0; attempt < MUTATION_ATTEMPTS && child === null; attempt += 1) {
        child = mutate(parent.node, rng, mutationCtx);
      }
      nodes.push(child ?? parent.node);
      inherited.push(new Float64Array(parent.parameters));
    }
    const offspring = evaluateNodes(nodes, inherited, problem, names, optimizeProbability, rng);
    evaluations += offspring.length;
    for (const ind of offspring) {
      hallOfFame.add(ind);
    }
    const merged = [...population, ...offspring];
    merged.sort((a, b) => compareLoss(a.loss, b.loss) || a.complexity - b.complexity);
    const seen = new Set<string>();
    population = [];
    for (const ind of merged) {
      if (population.length >= populationSize) {
        break;
      }
      if (!seen.has(ind.key)) {
        seen.add(ind.key);
        population.push(ind);
      }
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
