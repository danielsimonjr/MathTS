/**
 * PySR-style regularized evolution over {@link ScalarNode} trees (M13).
 *
 * @packageDocumentation
 */

import { pairwiseSum, type SeededRng } from '@danielsimonjr/mathts-core';
import {
  enumerateScalars,
  scalarComplexity,
  scalarGrammarAccepts,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import type { WorkerPool } from '@danielsimonjr/mathts-parallel';
import { fitScalarParameters } from './fit-scalar.js';
import {
  evaluateScalarPopulation,
  type ScalarPopulationParallelOptions,
} from './scalar-batch-parallel.js';
import { paretoFront, scoreFront, selectFrontModel, type ScoredCandidate } from './pareto-front.js';
import { compileScalar } from './scalar-compile.js';
import { weightedMutation, type ScalarMutationContext } from './scalar-mutate.js';

/** Columnar regression target for {@link searchScalars}. */
export interface ScalarSearchProblem {
  readonly variables: readonly string[];
  readonly columns: readonly Float64Array[];
  readonly observed: Float64Array;
  readonly parameters?: readonly string[];
}

/** Optional worker evaluation (M14); omitted keeps evaluation on the caller thread. */
export interface ScalarSearchParallelOptions {
  readonly timeoutMs?: number;
  readonly pool?: Pick<WorkerPool, 'execute'>;
}

/** Budget and evolution knobs for {@link searchScalars}. */
export interface ScalarSearchOptions {
  readonly grammar: ScalarGrammar;
  readonly rng: SeededRng;
  readonly populationSize?: number;
  readonly tournamentSize?: number;
  readonly tournamentP?: number;
  readonly optimizeProbability?: number;
  readonly maxEvaluations: number;
  readonly maxCandidates?: number;
  readonly seeds?: readonly ScalarNode[];
  readonly perturbationFactor?: number;
  readonly modelSelection?: 'accuracy' | 'score' | 'best';
  readonly populations?: number;
  readonly fractionReplaced?: number;
  readonly annealing?: boolean;
  readonly initialTemperature?: number;
  readonly adaptiveParsimony?: boolean;
  readonly adaptiveParsimonyScaling?: number;
  readonly parallel?: ScalarSearchParallelOptions;
}

/** One progress event; `status` is always `'fitted'`. */
export interface SearchProgress {
  readonly status: 'fitted';
  readonly evaluations: number;
  readonly front: ScoredCandidate<ScalarNode>[];
  readonly selected?: ScoredCandidate<ScalarNode>;
}

export type ScalarSearchStopReason = 'max-evaluations' | 'max-candidates';

/** Final value of the async generator returned by {@link searchScalars}. */
export interface ScalarSearchResult {
  readonly front: ScoredCandidate<ScalarNode>[];
  readonly stopReason: ScalarSearchStopReason;
  readonly evaluations: number;
  readonly seed: number;
  readonly selected?: ScoredCandidate<ScalarNode>;
}

/** @deprecated Use {@link ScalarSearchResult}. */
export type SearchScalarsResult = ScalarSearchResult;

/** @deprecated Use {@link ScalarSearchOptions}. */
export type SearchScalarsOptions = ScalarSearchOptions;

interface EvaluatedIndividual {
  readonly node: ScalarNode;
  readonly loss: number;
  readonly complexity: number;
  readonly parameters: Float64Array;
}

const DEFAULT_POPULATION_SIZE = 27;
const DEFAULT_TOURNAMENT_SIZE = 15;
const DEFAULT_TOURNAMENT_P = 0.982;
const DEFAULT_OPTIMIZE_PROBABILITY = 0.14;
const DEFAULT_FRACTION_REPLACED = 0.00036;
const DEFAULT_INITIAL_TEMPERATURE = 3.17;
const DEFAULT_ADAPTIVE_PARSIMONY_SCALING = 1040;

function paramNames(problem: ScalarSearchProblem, grammar: ScalarGrammar): readonly string[] {
  return problem.parameters ?? grammar.parameters ?? [];
}

function defaultParameters(n: number): Float64Array {
  const out = new Float64Array(n);
  out.fill(1);
  return out;
}

function sumSquaredLoss(values: Float64Array, valid: Uint8Array, observed: Float64Array): number {
  const terms = new Float64Array(observed.length);
  for (let i = 0; i < observed.length; i += 1) {
    if (valid[i] === 0) {
      terms[i] = 1e8;
    } else {
      const d = values[i]! - observed[i]!;
      terms[i] = d * d;
    }
  }
  return pairwiseSum(terms);
}

function lossFromCompile(
  node: ScalarNode,
  problem: ScalarSearchProblem,
  names: readonly string[],
  parameters: Float64Array
): number {
  const compiled = compileScalar(node, {
    variables: problem.variables,
    parameters: names,
  });
  const batch = compiled.evaluate(problem.columns, parameters);
  return sumSquaredLoss(batch.values, batch.valid, problem.observed);
}

function evaluateIndividual(
  node: ScalarNode,
  problem: ScalarSearchProblem,
  names: readonly string[],
  optimizeProbability: number,
  rng: SeededRng,
  alwaysOptimize: boolean
): EvaluatedIndividual {
  let parameters = defaultParameters(names.length);
  if (names.length > 0 && (alwaysOptimize || rng.next() < optimizeProbability)) {
    const fit = fitScalarParameters(node, problem.columns, problem.observed, problem.variables, {
      parameters: names,
      restarts: 2,
      maxIterations: 8,
      rng: rng.fork('fit'),
    });
    parameters = fit.parameters;
  }
  const loss = lossFromCompile(node, problem, names, parameters);
  return { node, loss, complexity: scalarComplexity(node), parameters };
}

function tournamentSelect(
  population: readonly EvaluatedIndividual[],
  rng: SeededRng,
  tournamentSize: number,
  tournamentP: number,
  metric: (ind: EvaluatedIndividual) => number
): EvaluatedIndividual {
  const n = population.length;
  const k = Math.min(tournamentSize, n);
  const contestants: EvaluatedIndividual[] = [];
  for (let i = 0; i < k; i += 1) {
    contestants.push(population[rng.nextInt(n)]!);
  }
  contestants.sort((a, b) => metric(a) - metric(b));
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

function complexityFrequencies(population: readonly EvaluatedIndividual[]): Map<number, number> {
  const freq = new Map<number, number>();
  for (const ind of population) {
    freq.set(ind.complexity, (freq.get(ind.complexity) ?? 0) + 1);
  }
  return freq;
}

function tournamentMetric(
  ind: EvaluatedIndividual,
  freq: Map<number, number>,
  popSize: number,
  scaling: number,
  adaptive: boolean
): number {
  if (!adaptive) {
    return ind.loss;
  }
  const frequency = (freq.get(ind.complexity) ?? 1) / popSize;
  return ind.loss + scaling * frequency;
}

function cloneIndividual(ind: EvaluatedIndividual): EvaluatedIndividual {
  return {
    node: ind.node,
    loss: ind.loss,
    complexity: ind.complexity,
    parameters: new Float64Array(ind.parameters),
  };
}

function streamRng(parent: SeededRng, populations: number, index: number): SeededRng {
  if (populations === 1) {
    return parent.fork('population');
  }
  return parent.fork(`island:${index}`);
}

function initialTrees(
  grammar: ScalarGrammar,
  seeds: readonly ScalarNode[] | undefined,
  populationSize: number,
  maxCandidates: number | undefined,
  rng: SeededRng
): ScalarNode[] {
  const out: ScalarNode[] = [];
  if (seeds !== undefined) {
    for (const seed of seeds) {
      if (out.length >= populationSize) {
        break;
      }
      if (scalarGrammarAccepts(grammar, seed)) {
        out.push(seed);
      }
    }
  }
  const budget = { maxCandidates: maxCandidates ?? Number.MAX_SAFE_INTEGER };
  for (const tree of enumerateScalars(grammar, budget)) {
    if (out.length >= populationSize) {
      break;
    }
    out.push(tree);
  }
  while (out.length < populationSize) {
    out.push(out[rng.nextInt(out.length)]!);
  }
  return out.slice(0, populationSize);
}

function migrateIslands(
  islands: EvaluatedIndividual[][],
  fractionReplaced: number,
  rng: SeededRng
): void {
  const count = islands.length;
  if (count < 2 || fractionReplaced <= 0) {
    return;
  }
  for (let i = 0; i < count; i += 1) {
    const pop = islands[i]!;
    const replaceCount = Math.max(1, Math.floor(fractionReplaced * pop.length));
    const worst = [...pop].sort((a, b) => b.loss - a.loss);
    for (let r = 0; r < replaceCount; r += 1) {
      let donorIdx = rng.nextInt(count - 1);
      if (donorIdx >= i) {
        donorIdx += 1;
      }
      const migrant = islands[donorIdx]![rng.nextInt(islands[donorIdx]!.length)]!;
      const slot = pop.indexOf(worst[r]!);
      if (slot >= 0) {
        pop[slot] = cloneIndividual(migrant);
      }
    }
  }
}

function scoredFront(archive: readonly EvaluatedIndividual[]): ScoredCandidate<ScalarNode>[] {
  const raw = archive.map((row) => ({
    loss: row.loss,
    complexity: row.complexity,
    item: row.node,
  }));
  return scoreFront(paretoFront(raw));
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

async function evaluateBatch(
  nodes: readonly ScalarNode[],
  problem: ScalarSearchProblem,
  names: readonly string[],
  parallel: ScalarPopulationParallelOptions | undefined,
  startIndex: number
): Promise<EvaluatedIndividual[]> {
  if (nodes.length === 0) {
    return [];
  }
  const defaultParams = defaultParameters(names.length);
  if (parallel !== undefined) {
    const items = nodes.map((node, i) => ({
      index: startIndex + i,
      node,
      params: names.length > 0 ? [...defaultParams] : undefined,
    }));
    const results = await evaluateScalarPopulation({
      variables: problem.variables,
      parameters: names,
      columns: problem.columns,
      items,
      parallel,
    });
    return results.map((row, i) => {
      const node = nodes[i]!;
      const loss = sumSquaredLoss(row.batch.values, row.batch.valid, problem.observed);
      return {
        node,
        loss,
        complexity: scalarComplexity(node),
        parameters: defaultParams,
      };
    });
  }
  return nodes.map((node) => ({
    node,
    loss: lossFromCompile(node, problem, names, defaultParams),
    complexity: scalarComplexity(node),
    parameters: defaultParams,
  }));
}

/**
 * Symbolic regression search over scalar expression trees.
 */
export async function* searchScalars(
  problem: ScalarSearchProblem,
  options: ScalarSearchOptions
): AsyncGenerator<SearchProgress, ScalarSearchResult> {
  const populationSize = options.populationSize ?? DEFAULT_POPULATION_SIZE;
  const tournamentSize = options.tournamentSize ?? DEFAULT_TOURNAMENT_SIZE;
  const tournamentP = options.tournamentP ?? DEFAULT_TOURNAMENT_P;
  const optimizeProbability = options.optimizeProbability ?? DEFAULT_OPTIMIZE_PROBABILITY;
  const maxEvaluations = options.maxEvaluations;
  const maxCandidates = options.maxCandidates;
  const populations = options.populations ?? 1;
  const multiIsland = populations > 1;
  const fractionReplaced = options.fractionReplaced ?? DEFAULT_FRACTION_REPLACED;
  const annealingOn = multiIsland && options.annealing !== false;
  const adaptiveOn = multiIsland && options.adaptiveParsimony !== false;
  const adaptiveScaling = options.adaptiveParsimonyScaling ?? DEFAULT_ADAPTIVE_PARSIMONY_SCALING;
  const perturbationFactor = options.perturbationFactor ?? 0.25;
  const names = paramNames(problem, options.grammar);
  const alwaysOptimize = names.length > 0;
  const mutate = weightedMutation();
  const parallel = options.parallel;
  let temperature = annealingOn ? (options.initialTemperature ?? DEFAULT_INITIAL_TEMPERATURE) : 1;

  let evaluations = 0;
  let globalIndex = 0;
  let stopReason: ScalarSearchStopReason = 'max-evaluations';
  const archive: EvaluatedIndividual[] = [];
  const islandRngs: SeededRng[] = [];
  const islands: EvaluatedIndividual[][] = [];

  for (let i = 0; i < populations; i += 1) {
    islandRngs.push(streamRng(options.rng, populations, i));
  }

  for (let i = 0; i < populations; i += 1) {
    const trees = initialTrees(
      options.grammar,
      options.seeds,
      populationSize,
      maxCandidates,
      islandRngs[i]!
    );
    let pop = await evaluateBatch(trees, problem, names, parallel, globalIndex);
    globalIndex += trees.length;
    evaluations += trees.length;
    pop = pop.map((ind) =>
      evaluateIndividual(
        ind.node,
        problem,
        names,
        optimizeProbability,
        islandRngs[i]!,
        alwaysOptimize
      )
    );
    for (const ind of pop) {
      archive.push(ind);
    }
    islands.push(pop);
  }

  const report = (): SearchProgress => {
    const front = scoredFront(archive);
    return {
      status: 'fitted',
      evaluations,
      front,
      selected: pickSelected(front, options.modelSelection),
    };
  };

  yield report();

  while (evaluations < maxEvaluations) {
    if (maxCandidates !== undefined && evaluations >= maxCandidates) {
      stopReason = 'max-candidates';
      break;
    }

    for (let isl = 0; isl < populations; isl += 1) {
      const rng = islandRngs[isl]!;
      let pop = islands[isl]!;
      if (pop.length === 0) {
        continue;
      }
      const freq = complexityFrequencies(pop);
      const metric = (ind: EvaluatedIndividual) =>
        tournamentMetric(ind, freq, pop.length, adaptiveScaling, adaptiveOn);
      const mutationCtx: ScalarMutationContext = {
        grammar: options.grammar,
        perturbationFactor,
        temperature,
      };
      const offspringNodes: ScalarNode[] = [];
      while (
        offspringNodes.length < populationSize &&
        evaluations + offspringNodes.length < maxEvaluations
      ) {
        if (maxCandidates !== undefined && evaluations + offspringNodes.length >= maxCandidates) {
          break;
        }
        const parent = tournamentSelect(pop, rng, tournamentSize, tournamentP, metric);
        const mutated = mutate(parent.node, rng, mutationCtx);
        offspringNodes.push(mutated ?? parent.node);
      }
      if (offspringNodes.length === 0) {
        continue;
      }
      let offspring = await evaluateBatch(offspringNodes, problem, names, parallel, globalIndex);
      globalIndex += offspringNodes.length;
      evaluations += offspringNodes.length;
      offspring = offspring.map((ind) =>
        evaluateIndividual(ind.node, problem, names, optimizeProbability, rng, alwaysOptimize)
      );
      for (const ind of offspring) {
        archive.push(ind);
      }
      const merged = [...pop, ...offspring];
      merged.sort((a, b) => a.loss - b.loss || a.complexity - b.complexity);
      pop = merged.slice(0, populationSize);
      islands[isl] = pop;
    }

    if (multiIsland) {
      migrateIslands(islands, fractionReplaced, options.rng.fork('migration'));
    }
    if (annealingOn) {
      temperature *= 0.995;
    }

    yield report();

    if (evaluations >= maxEvaluations) {
      stopReason = 'max-evaluations';
      break;
    }
    if (maxCandidates !== undefined && evaluations >= maxCandidates) {
      stopReason = 'max-candidates';
      break;
    }
    await Promise.resolve();
  }

  const finalFront = report();
  return {
    front: finalFront.front,
    stopReason,
    evaluations,
    seed: options.rng.seed,
    selected: finalFront.selected,
  };
}
