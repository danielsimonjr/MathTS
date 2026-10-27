/**
 * Guarded numerical equivalence for scalar trees (UPT §9 level 5).
 *
 * Samples random points in a caller-supplied domain, evaluates both trees with
 * {@link compileScalar}, and compares with {@link nearlyEqual} from core.
 * **Numerical agreement alone never proves symbolic equivalence.** A
 * `consistent` verdict is evidence, not proof.
 *
 * @packageDocumentation
 */

import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { scalarSymbols } from '@danielsimonjr/mathts-expression';
import type { SeededRng } from '@danielsimonjr/mathts-core';
import { nearlyEqual } from '@danielsimonjr/mathts-core/internal';
import { compileScalar } from './scalar-compile.js';
import { NUMERIC_LITERAL } from './scalar-eval.js';

const PREFIX = 'numericallyEquivalent:';

/**
 * Thrown for invalid options (bad domain, tolerances, RNG, samples, and so on).
 * Does not wrap {@link ScalarEvalError} from bad trees.
 *
 * @example
 * ```ts
 * import { numericallyEquivalent, NumericEquivalenceError, scalar } from '@danielsimonjr/mathts-functions';
 * import { createSeededRng } from '@danielsimonjr/mathts-core';
 * try {
 *   numericallyEquivalent(scalar.symbol('x'), scalar.symbol('x'), {
 *     domain: {},
 *     rng: createSeededRng(0),
 *   });
 * } catch (e) {
 *   e instanceof NumericEquivalenceError; // true — missing domain for x
 * }
 * ```
 */
export class NumericEquivalenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NumericEquivalenceError';
  }
}

/**
 * Options for {@link numericallyEquivalent}.
 *
 * @example
 * ```ts
 * import type { NumericEquivalenceOptions } from '@danielsimonjr/mathts-functions';
 * import { createSeededRng } from '@danielsimonjr/mathts-core';
 * const opts: NumericEquivalenceOptions = {
 *   domain: { x: [0, 1] },
 *   rng: createSeededRng(42),
 * };
 * ```
 */
export interface NumericEquivalenceOptions {
  /** Per-symbol sampling box `[lo, hi)` (half-open unless `lo === hi`). */
  readonly domain: Readonly<Record<string, readonly [number, number]>>;
  /** Sample count when there is at least one free symbol (default 64). */
  readonly samples?: number;
  /** Required stream; the implementation calls `next()` only. */
  readonly rng: SeededRng;
  /** Relative tolerance (default `1e-9`). */
  readonly relTol?: number;
  /** Absolute tolerance (default `1e-12`). */
  readonly absTol?: number;
  /** When true, test whether `a` and `b` agree up to a single scale factor. */
  readonly upToConstant?: boolean;
  /** Symbol names to sample log-uniformly on a strictly positive box. */
  readonly logUniform?: readonly string[];
}

/**
 * Result of {@link numericallyEquivalent}.
 *
 * @example
 * ```ts
 * import { numericallyEquivalent, scalar } from '@danielsimonjr/mathts-functions';
 * import { createSeededRng } from '@danielsimonjr/mathts-core';
 * const r = numericallyEquivalent(scalar.number(1), scalar.number(1), {
 *   domain: {},
 *   rng: createSeededRng(0),
 * });
 * r.verdict; // 'consistent'
 * ```
 */
export type NumericEquivalence =
  | { readonly verdict: 'consistent'; readonly samplesUsed: number; readonly constant?: number }
  | {
      readonly verdict: 'counterexample';
      readonly at: Readonly<Record<string, number>>;
      readonly a: number;
      readonly b: number;
    }
  | { readonly verdict: 'inconclusive'; readonly reason: 'too-few-valid-samples' };

function fail(message: string): never {
  throw new NumericEquivalenceError(`${PREFIX} ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function symbolsOf(node: ScalarNode): readonly string[] {
  try {
    return scalarSymbols(node);
  } catch (err) {
    // Broken trees should surface as ScalarEvalError from the tape compiler.
    compileScalar(node, { variables: [] });
    throw err;
  }
}

function freeSymbols(a: ScalarNode, b: ScalarNode): string[] {
  const names = new Set<string>();
  for (const n of symbolsOf(a)) {
    if (!NUMERIC_LITERAL.test(n)) names.add(n);
  }
  for (const n of symbolsOf(b)) {
    if (!NUMERIC_LITERAL.test(n)) names.add(n);
  }
  return [...names].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

function validateDomainPair(name: string, pair: unknown, logUniformSet: ReadonlySet<string>): void {
  if (!Array.isArray(pair) || pair.length !== 2) {
    fail(`domain['${name}'] must be a [lo, hi] pair`);
  }
  const lo = pair[0];
  const hi = pair[1];
  if (typeof lo !== 'number' || typeof hi !== 'number') {
    fail(`domain['${name}'] must be a [lo, hi] pair of finite numbers`);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    fail(`domain['${name}'] must be a [lo, hi] pair of finite numbers`);
  }
  if (lo > hi) {
    fail(`domain['${name}']: lo must be <= hi`);
  }
  if (logUniformSet.has(name)) {
    if (lo <= 0) {
      fail(`domain['${name}'] must be strictly positive for log-uniform sampling`);
    }
  }
}

function validateOptions(options: NumericEquivalenceOptions): {
  samples: number;
  relTol: number;
  absTol: number;
  upToConstant: boolean;
  logUniform: ReadonlySet<string>;
  domain: Readonly<Record<string, readonly [number, number]>>;
  rng: SeededRng;
} {
  if (options === null || options === undefined || typeof options !== 'object') {
    fail('options must be an object');
  }

  const rng = options.rng;
  if (rng === null || rng === undefined || typeof rng.next !== 'function') {
    fail('rng is required and must provide next()');
  }

  let samples = 64;
  if (options.samples !== undefined) {
    const s = options.samples;
    if (!Number.isInteger(s) || s < 1) {
      fail('samples must be an integer >= 1');
    }
    samples = s;
  }

  let relTol = 1e-9;
  if (options.relTol !== undefined) {
    if (!Number.isFinite(options.relTol) || options.relTol <= 0) {
      fail('relTol must be a finite number > 0');
    }
    relTol = options.relTol;
  }

  let absTol = 1e-12;
  if (options.absTol !== undefined) {
    if (!Number.isFinite(options.absTol) || options.absTol < 0) {
      fail('absTol must be a finite number >= 0');
    }
    absTol = options.absTol;
  }

  let upToConstant = false;
  if (options.upToConstant !== undefined) {
    if (typeof options.upToConstant !== 'boolean') {
      fail('upToConstant must be a boolean');
    }
    upToConstant = options.upToConstant;
  }

  let logUniformList: readonly string[] = [];
  if (options.logUniform !== undefined) {
    if (!Array.isArray(options.logUniform)) {
      fail('logUniform must be an array of strings');
    }
    for (const entry of options.logUniform) {
      if (typeof entry !== 'string') {
        fail('logUniform must be an array of strings');
      }
    }
    const seen = new Set<string>();
    for (const name of options.logUniform) {
      if (seen.has(name)) {
        fail(`duplicate logUniform name '${name}'`);
      }
      seen.add(name);
    }
    logUniformList = options.logUniform;
  }
  const logUniformSet = new Set(logUniformList);

  const domain = options.domain;
  if (!isPlainObject(domain)) {
    fail('domain must be a non-null object');
  }

  for (const name of logUniformList) {
    if (!Object.hasOwn(domain, name)) {
      fail(`logUniform symbol '${name}' has no own domain entry`);
    }
  }

  for (const key of Object.keys(domain)) {
    if (!Object.hasOwn(domain, key)) continue;
    validateDomainPair(key, domain[key], logUniformSet);
  }

  return {
    samples,
    relTol,
    absTol,
    upToConstant,
    logUniform: logUniformSet,
    domain,
    rng,
  };
}

function sampleUniform(lo: number, hi: number, u: number): number {
  if (lo === hi) return lo;
  return lo + (hi - lo) * u;
}

function sampleLogUniform(lo: number, hi: number, u: number): number {
  if (lo === hi) return lo;
  return Math.exp(Math.log(lo) + u * (Math.log(hi) - Math.log(lo)));
}

function rowIsValid(validA: number, validB: number, valueA: number, valueB: number): boolean {
  if (validA === 0 || validB === 0) return false;
  if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) return false;
  return true;
}

function makeAtRecord(
  symbols: readonly string[],
  rowValues: readonly number[]
): Record<string, number> {
  const at = Object.create(null) as Record<string, number>;
  for (let i = 0; i < symbols.length; i++) {
    at[symbols[i]] = rowValues[i];
  }
  return at;
}

/**
 * Compare two scalar trees by random sampling in a domain.
 *
 * **Numerical agreement alone never proves symbolic equivalence.** A
 * `consistent` verdict is evidence, not proof.
 *
 * @example
 * ```ts
 * import { numericallyEquivalent, scalar } from '@danielsimonjr/mathts-functions';
 * import { createSeededRng } from '@danielsimonjr/mathts-core';
 * const rng = createSeededRng(1);
 * const lhs = scalar.op('+', [
 *   scalar.op('^', [scalar.call('sin', scalar.symbol('x')), scalar.number(2)]),
 *   scalar.op('^', [scalar.call('cos', scalar.symbol('x')), scalar.number(2)]),
 * ]);
 * const r = numericallyEquivalent(lhs, scalar.number(1), { domain: { x: [0, 1] }, rng });
 * r.verdict === 'consistent'; // evidence only — not a proof of identity
 * ```
 */
export function numericallyEquivalent(
  a: ScalarNode,
  b: ScalarNode,
  options: NumericEquivalenceOptions
): NumericEquivalence {
  const { samples, relTol, absTol, upToConstant, logUniform, domain, rng } =
    validateOptions(options);

  const symbols = freeSymbols(a, b);
  for (const name of symbols) {
    if (!Object.hasOwn(domain, name)) {
      fail(`missing domain entry for symbol '${name}'`);
    }
  }

  const attempts = symbols.length === 0 ? 1 : samples;

  const columns: Float64Array[] = symbols.map(() => new Float64Array(attempts));

  for (let row = 0; row < attempts; row++) {
    for (let col = 0; col < symbols.length; col++) {
      const name = symbols[col];
      const pair = domain[name]!;
      const lo = pair[0];
      const hi = pair[1];
      // Point boxes are the bound itself; do not consume the stream.
      if (lo === hi) {
        columns[col][row] = lo;
        continue;
      }
      const u = rng.next();
      columns[col][row] = logUniform.has(name)
        ? sampleLogUniform(lo, hi, u)
        : sampleUniform(lo, hi, u);
    }
  }

  const compiledA = compileScalar(a, { variables: symbols });
  const compiledB = compileScalar(b, { variables: symbols });
  const batchA = compiledA.evaluate(columns);
  const batchB = compiledB.evaluate(columns);

  const validRows: number[] = [];
  for (let row = 0; row < attempts; row++) {
    if (rowIsValid(batchA.valid[row], batchB.valid[row], batchA.values[row], batchB.values[row])) {
      validRows.push(row);
    }
  }

  const minValid = Math.max(1, Math.ceil(attempts / 2));
  if (validRows.length < minValid) {
    return { verdict: 'inconclusive', reason: 'too-few-valid-samples' };
  }

  if (!upToConstant) {
    for (const row of validRows) {
      const va = batchA.values[row];
      const vb = batchB.values[row];
      if (!nearlyEqual(va, vb, relTol, absTol)) {
        const rowValues = symbols.map((_, col) => columns[col][row]);
        return {
          verdict: 'counterexample',
          at: makeAtRecord(symbols, rowValues),
          a: va,
          b: vb,
        };
      }
    }
    return { verdict: 'consistent', samplesUsed: validRows.length };
  }

  let scale: number | undefined;

  for (const row of validRows) {
    const va = batchA.values[row];
    const vb = batchB.values[row];
    if (Math.abs(vb) <= absTol) {
      if (Math.abs(va) > absTol) {
        const rowValues = symbols.map((_, col) => columns[col][row]);
        return {
          verdict: 'counterexample',
          at: makeAtRecord(symbols, rowValues),
          a: va,
          b: vb,
        };
      }
      continue;
    }
    if (scale === undefined) {
      const c = va / vb;
      if (!Number.isFinite(c)) {
        const rowValues = symbols.map((_, col) => columns[col][row]);
        return {
          verdict: 'counterexample',
          at: makeAtRecord(symbols, rowValues),
          a: va,
          b: vb,
        };
      }
      scale = c;
      continue;
    }
  }

  if (scale === undefined) {
    return { verdict: 'consistent', samplesUsed: validRows.length, constant: 0 };
  }

  for (const row of validRows) {
    const va = batchA.values[row];
    const vb = batchB.values[row];
    if (!nearlyEqual(va, scale! * vb, relTol, absTol)) {
      const rowValues = symbols.map((_, col) => columns[col][row]);
      return {
        verdict: 'counterexample',
        at: makeAtRecord(symbols, rowValues),
        a: va,
        b: vb,
      };
    }
  }

  return { verdict: 'consistent', samplesUsed: validRows.length, constant: scale };
}
