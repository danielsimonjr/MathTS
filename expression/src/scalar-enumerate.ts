/**
 * Deterministic bounded enumeration of {@link ScalarNode} trees from a
 * {@link ScalarGrammar}. Home: `expression/src/scalar-enumerate.ts` (D-1:
 * no `@danielsimonjr/mathts-symbolic-search` package). Before merge, run
 * `bun run docs:deps` and `bun run docs:graph -- cycles`; a cycle is an import bug.
 *
 * Constraint checking is centralized in {@link scalarGrammarAccepts}; the generator
 * applies `admit` only at yield time (and optionally when choosing child subtrees).
 *
 * @packageDocumentation
 */

import {
  createScalarBuilder,
  type LoweredScalarFn,
  type ScalarNode,
  type ScalarOperator,
} from './scalar-builder.js';
import { forEachScalar, scalarCanonicalKey, scalarDepth, scalarSize } from './scalar-structure.js';
import { hasOwnProperty } from './utils/object.js';

/** Search-space descriptor for scalar expression enumeration. */
export interface ScalarGrammar {
  readonly variables: readonly string[];
  readonly parameters?: readonly string[];
  readonly literals?: readonly number[];
  readonly binary: readonly ScalarOperator[];
  readonly unary: readonly LoweredScalarFn[];
  readonly maxSize: number;
  readonly maxDepth?: number;
  readonly argumentLimits?: Readonly<Record<string, readonly number[]>>;
  readonly nesting?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly admit?: (node: ScalarNode) => boolean;
  readonly admitMonotone?: boolean;
}

/** Caps on how many trees {@link enumerateScalars} may yield. */
export interface EnumerationBudget {
  readonly maxCandidates: number;
  readonly maxWallClockMs?: number;
}

/** Why {@link enumerateScalars} stopped yielding. */
export type EnumerationStop = 'exhausted-space' | 'candidate-limit' | 'time-limit' | 'cancelled';

function nodeOperatorName(node: ScalarNode): string | null {
  if (node.kind === 'op') {
    return node.op;
  }
  if (node.kind === 'call') {
    return node.fn;
  }
  return null;
}

function countNamedInSubtree(root: ScalarNode, inner: string): number {
  let count = 0;
  function walk(n: ScalarNode, isRoot: boolean): void {
    if (!isRoot && nodeOperatorName(n) === inner) {
      count += 1;
    }
    if (n.kind === 'call') {
      walk(n.arg, false);
    } else if (n.kind === 'op') {
      for (const child of n.args) {
        walk(child, false);
      }
    }
  }
  walk(root, true);
  return count;
}

function argumentLimitsOk(
  node: ScalarNode,
  argumentLimits: Readonly<Record<string, readonly number[]>>
): boolean {
  const name = nodeOperatorName(node);
  if (name === null || !hasOwnProperty(argumentLimits, name)) {
    return true;
  }
  const limits = argumentLimits[name];
  if (node.kind === 'call') {
    const cap = limits[0];
    if (cap !== undefined && cap !== -1 && scalarSize(node.arg) > cap) {
      return false;
    }
    return true;
  }
  if (node.kind === 'op') {
    for (let i = 0; i < node.args.length; i += 1) {
      const cap = limits[i];
      if (cap !== undefined && cap !== -1 && scalarSize(node.args[i]!) > cap) {
        return false;
      }
    }
  }
  return true;
}

function nestingOk(
  node: ScalarNode,
  nesting: Readonly<Record<string, Readonly<Record<string, number>>>>
): boolean {
  let ok = true;
  forEachScalar(node, (sub) => {
    const outer = nodeOperatorName(sub);
    if (outer === null || !hasOwnProperty(nesting, outer)) {
      return;
    }
    const innerLimits = nesting[outer]!;
    for (const inner of Object.keys(innerLimits)) {
      if (!hasOwnProperty(innerLimits, inner)) {
        continue;
      }
      const max = innerLimits[inner]!;
      if (countNamedInSubtree(sub, inner) > max) {
        ok = false;
      }
    }
  });
  return ok;
}

function symbolAllowed(grammar: ScalarGrammar, name: string): boolean {
  if (grammar.variables.includes(name)) {
    return true;
  }
  const params = grammar.parameters;
  return params !== undefined && params.includes(name);
}

function nodeStructureOk(grammar: ScalarGrammar, node: ScalarNode): boolean {
  switch (node.kind) {
    case 'number':
      return Number.isFinite(node.value);
    case 'symbol':
      return symbolAllowed(grammar, node.name);
    case 'call':
      if (!grammar.unary.includes(node.fn)) {
        return false;
      }
      return nodeStructureOk(grammar, node.arg);
    case 'op':
      if (!grammar.binary.includes(node.op)) {
        return false;
      }
      if (node.args.length !== 2) {
        return false;
      }
      return nodeStructureOk(grammar, node.args[0]!) && nodeStructureOk(grammar, node.args[1]!);
  }
}

/**
 * Whether `node` satisfies the grammar's structural rules (operators, symbols,
 * size/depth budgets, argument limits, nesting). Does not invoke `admit`.
 */
export function scalarGrammarAccepts(grammar: ScalarGrammar, node: ScalarNode): boolean {
  if (!nodeStructureOk(grammar, node)) {
    return false;
  }
  if (!(scalarSize(node) <= grammar.maxSize)) {
    return false;
  }
  const maxDepth = grammar.maxDepth;
  if (maxDepth !== undefined && !(scalarDepth(node) <= maxDepth)) {
    return false;
  }
  if (grammar.argumentLimits !== undefined) {
    let limitsOk = true;
    forEachScalar(node, (sub) => {
      if (!argumentLimitsOk(sub, grammar.argumentLimits!)) {
        limitsOk = false;
      }
    });
    if (!limitsOk) {
      return false;
    }
  }
  if (grammar.nesting !== undefined && !nestingOk(node, grammar.nesting)) {
    return false;
  }
  return true;
}

/** A candidate that may serve as a child of a larger tree. */
interface PooledNode {
  readonly node: ScalarNode;
  readonly size: number;
}

/** Read the abort signal and the clock once per this many candidates between yields. */
const INTERRUPT_CHECK_INTERVAL = 128;

function assertEnumerationInputs(grammar: ScalarGrammar, budget: EnumerationBudget): void {
  if (Number.isNaN(grammar.maxSize)) {
    throw new RangeError('enumerateScalars: grammar.maxSize must not be NaN');
  }
  if (grammar.maxDepth !== undefined && Number.isNaN(grammar.maxDepth)) {
    throw new RangeError('enumerateScalars: grammar.maxDepth must not be NaN');
  }
  if (Number.isNaN(budget.maxCandidates) || budget.maxCandidates < 0) {
    throw new RangeError('enumerateScalars: budget.maxCandidates must be a number >= 0');
  }
  if (budget.maxWallClockMs !== undefined && Number.isNaN(budget.maxWallClockMs)) {
    throw new RangeError('enumerateScalars: budget.maxWallClockMs must not be NaN');
  }
}

/**
 * Yields distinct scalar trees in non-decreasing {@link scalarSize}, deduplicated
 * by {@link scalarCanonicalKey}. Visit order is deterministic and does not use a RNG.
 *
 * The abort signal and the wall clock are read before every yield and also every
 * {@link INTERRUPT_CHECK_INTERVAL} candidates that produce no yield, so a grammar
 * whose `admit` rejects almost everything still stops when asked.
 */
export function* enumerateScalars(
  grammar: ScalarGrammar,
  budget: EnumerationBudget,
  signal?: AbortSignal
): Generator<ScalarNode, EnumerationStop> {
  assertEnumerationInputs(grammar, budget);
  const b = createScalarBuilder();
  const yieldedKeys = new Set<string>();
  const pooledKeys = new Set<string>();
  const pool: PooledNode[] = [];
  const bySize: PooledNode[][] = [];
  let yieldCount = 0;
  let sinceCheck = 0;
  const start = performance.now();
  const admitMonotone = grammar.admitMonotone === true;

  const interrupted = (): EnumerationStop | null => {
    if (signal?.aborted) {
      return 'cancelled';
    }
    if (budget.maxWallClockMs !== undefined && performance.now() - start >= budget.maxWallClockMs) {
      return 'time-limit';
    }
    return null;
  };

  const addToPool = (node: ScalarNode, size: number, key: string): void => {
    if (pooledKeys.has(key)) {
      return;
    }
    pooledKeys.add(key);
    const entry: PooledNode = { node, size };
    pool.push(entry);
    (bySize[size] ??= []).push(entry);
  };

  const consider = function* (
    node: ScalarNode,
    size: number
  ): Generator<ScalarNode, EnumerationStop | 'ok'> {
    sinceCheck += 1;
    if (sinceCheck >= INTERRUPT_CHECK_INTERVAL) {
      sinceCheck = 0;
      const stop = interrupted();
      if (stop !== null) {
        return stop;
      }
    }
    if (!scalarGrammarAccepts(grammar, node)) {
      return 'ok';
    }
    const key = scalarCanonicalKey(node);
    if (yieldedKeys.has(key)) {
      return 'ok';
    }

    const admitOk = grammar.admit === undefined || grammar.admit(node);
    if (!admitOk) {
      if (!admitMonotone) {
        addToPool(node, size, key);
      }
      return 'ok';
    }

    const stop = interrupted() ?? (yieldCount >= budget.maxCandidates ? 'candidate-limit' : null);
    if (stop !== null) {
      return stop;
    }
    sinceCheck = 0;
    addToPool(node, size, key);
    yieldedKeys.add(key);
    yieldCount += 1;
    yield node;
    return 'ok';
  };

  for (let size = 1; size <= grammar.maxSize; size += 1) {
    if (size === 1) {
      const leaves: ScalarNode[] = [];
      for (const name of grammar.variables) {
        leaves.push(b.symbol(name));
      }
      for (const name of grammar.parameters ?? []) {
        leaves.push(b.symbol(name));
      }
      for (const value of grammar.literals ?? []) {
        leaves.push(b.number(value));
      }
      for (const leaf of leaves) {
        const stop = yield* consider(leaf, 1);
        if (stop !== 'ok') {
          return stop;
        }
      }
      continue;
    }

    // Only entries of size <= size - 1 exist when this size starts; the ones this
    // loop adds have size `size` and cannot be a child of a size-`size` tree.
    const poolAtStart = pool.length;

    for (const op of grammar.binary) {
      for (let i = 0; i < poolAtStart; i += 1) {
        const left = pool[i]!;
        const rightSize = size - 1 - left.size;
        if (rightSize < 1) {
          continue;
        }
        for (const right of bySize[rightSize] ?? []) {
          const stop = yield* consider(b.op(op, [left.node, right.node]), size);
          if (stop !== 'ok') {
            return stop;
          }
        }
      }
    }

    for (const fn of grammar.unary) {
      for (const arg of bySize[size - 1] ?? []) {
        const stop = yield* consider({ kind: 'call', fn, arg: arg.node }, size);
        if (stop !== 'ok') {
          return stop;
        }
      }
    }
  }

  return 'exhausted-space';
}
