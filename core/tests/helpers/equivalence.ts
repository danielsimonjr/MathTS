/**
 * Reusable property-based equivalence harness (fast-check backed).
 *
 * Built for the cross-package dedup effort ("Bucket B"): before redirecting a
 * package's local utility copy onto the `@danielsimonjr/mathts-core/internal`
 * canonical, we must PROVE the copies are behaviorally equivalent rather than
 * assume it — see [[feedback-oracle-tests-implementation-independent]] and the
 * standing Rule-4 discipline ("never assume — verify with a second method").
 *
 * `assertEquivalent` runs `fc.property` over a supplied arbitrary, invoking two
 * (or more) candidate implementations on the SAME generated input and asserting:
 *   1. Output equivalence — either exact structural deep-equality (the default;
 *      appropriate for strings, booleans, and array/object/tree-shaped results
 *      like `clone`/`deepMap`/`flatten`/`factory` sort order), or numeric
 *      tolerance equality (ULP/epsilon — for numeric-format helpers where
 *      trivially different floating-point paths can legitimately differ in the
 *      last few bits).
 *   2. Neither implementation mutates its input arguments (deep-freezes plain
 *      object/array arguments before the call, and independently snapshots +
 *      re-diffs every argument after the call so an in-place mutation is caught
 *      even for argument shapes we intentionally don't freeze, e.g. class
 *      instances).
 *
 * This module is NOT itself a `*.test.ts` file (vitest's `include` glob is
 * `tests/**\/*.test.ts`), so it is safe to import from any package's test
 * suite without vitest trying to run it directly.
 */
import assert from 'node:assert/strict';
import fc from 'fast-check';

/** A named callable under test. */
export interface NamedImpl<Args extends readonly unknown[], R> {
  name: string;
  fn: (...args: Args) => R;
}

export type CompareMode = 'structural' | 'numeric';

export interface AssertEquivalentOptions<R> {
  /**
   * Comparison strategy for the two return values.
   *  - 'structural' (default): exact deep-equality (NaN-aware, via
   *    `assert.deepStrictEqual`). Use for strings/booleans/arrays/objects —
   *    i.e. anything where the two implementations should produce IDENTICAL
   *    output, not just "close" output. This is the right default for
   *    string-formatting utilities (`format`, `stringify`, `compareText`,
   *    `toFixed`, `toEngineering`, ...) which are expected to be byte-identical
   *    re-implementations, not merely numerically close.
   *  - 'numeric': tolerance-based equality for plain `number` results (or an
   *    array of numbers). Falls back to structural equality for non-numeric
   *    results (so a numeric-mode comparator can still be handed occasional
   *    non-numeric outputs, e.g. NaN sentinels or thrown-error markers, without
   *    throwing a type error).
   */
  compare?: CompareMode;
  /** Absolute epsilon for 'numeric' mode. Default 1e-9. */
  epsilon?: number;
  /** Relative (ULP-ish) tolerance for 'numeric' mode, scaled by magnitude. Default 1e-12. */
  relTolerance?: number;
  /**
   * Assert neither implementation mutates its input. Default true. Disable
   * only for implementations that are documented/intended to mutate (none in
   * this dedup effort should be).
   */
  checkMutation?: boolean;
  /** Number of fast-check runs. Default 1000. */
  numRuns?: number;
  /** Optional custom comparator, overrides `compare` entirely when provided. */
  isEqual?: (a: R, b: R) => boolean;
  /** Optional formatter for the counterexample args in a failure message. */
  formatArgs?: (args: unknown[]) => string;
}

/**
 * Deep-freeze plain arrays/objects (recursively) so an in-place mutation
 * throws immediately in strict mode. Deliberately does NOT freeze class
 * instances (e.g. Decimal/BigNumber-like values) — freezing an opaque
 * instance can break libraries that cache internal state on first access,
 * which would be a false positive unrelated to OUR mutation contract.
 */
function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  const proto: unknown = Object.getPrototypeOf(value);
  const isPlain = Array.isArray(value) || proto === Object.prototype || proto === null;
  if (isPlain) {
    for (const v of Object.values(value as Record<string, unknown>)) {
      deepFreeze(v, seen);
    }
    Object.freeze(value);
  }
  return value;
}

/** JSON-ish structural snapshot used to detect mutation on non-frozen (e.g. class) inputs. */
function snapshot(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === 'bigint') return `__bigint__${v.toString()}`;
    if (typeof v === 'function') return `__function__${v.name || 'anonymous'}`;
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return '__circular__';
      seen.add(v);
    }
    return v;
  });
}

function numbersClose(a: number, b: number, epsilon: number, relTolerance: number): boolean {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const diff = Math.abs(a - b);
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return diff <= epsilon || diff <= relTolerance * scale;
}

function defaultCompare<R>(
  a: R,
  b: R,
  opts: Required<Pick<AssertEquivalentOptions<R>, 'compare' | 'epsilon' | 'relTolerance'>>
): boolean {
  if (opts.compare === 'numeric') {
    if (typeof a === 'number' && typeof b === 'number') {
      return numbersClose(a, b, opts.epsilon, opts.relTolerance);
    }
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      return a.every((av, i) =>
        typeof av === 'number' && typeof b[i] === 'number'
          ? numbersClose(av, b[i] as number, opts.epsilon, opts.relTolerance)
          : structuralEqual(av, b[i])
      );
    }
    // Fall through to structural for non-numeric shapes under 'numeric' mode.
  }
  return structuralEqual(a, b);
}

function structuralEqual(a: unknown, b: unknown): boolean {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a property test asserting `implA(...)` and `implB(...)` (and any
 * additional impls) agree on every input the arbitrary generates, and that
 * none of them mutate their arguments.
 *
 * @param name       Label for the property (surfaced in failure messages).
 * @param impls      Two or more named candidate implementations to cross-check.
 * @param arbitrary  fast-check arbitrary generating the argument tuple.
 * @param opts       Comparison + run-count options (see {@link AssertEquivalentOptions}).
 */
export function assertEquivalent<Args extends readonly unknown[], R>(
  name: string,
  impls: [NamedImpl<Args, R>, NamedImpl<Args, R>, ...NamedImpl<Args, R>[]],
  arbitrary: fc.Arbitrary<Args>,
  opts: AssertEquivalentOptions<R> = {}
): void {
  const compareMode: CompareMode = opts.compare ?? 'structural';
  const epsilon = opts.epsilon ?? 1e-9;
  const relTolerance = opts.relTolerance ?? 1e-12;
  const checkMutation = opts.checkMutation ?? true;
  const numRuns = opts.numRuns ?? 1000;
  const isEqual =
    opts.isEqual ??
    ((a: R, b: R) => defaultCompare(a, b, { compare: compareMode, epsilon, relTolerance }));
  const formatArgs = opts.formatArgs ?? ((args: unknown[]) => JSON.stringify(args));

  fc.assert(
    fc.property(arbitrary, (args) => {
      const results: { name: string; value: R }[] = [];

      for (const impl of impls) {
        // Fresh, independently frozen/snapshotted copy of args per impl so one
        // impl's (hypothetical) mutation can't contaminate the next impl's run.
        const argsForThisImpl = args as unknown as Args;
        const before = checkMutation ? argsForThisImpl.map((a) => snapshot(a)) : null;
        if (checkMutation) {
          argsForThisImpl.forEach((a) => deepFreeze(a));
        }

        const value = impl.fn(...argsForThisImpl);

        if (checkMutation && before) {
          const after = argsForThisImpl.map((a) => snapshot(a));
          for (let i = 0; i < before.length; i++) {
            if (before[i] !== after[i]) {
              throw new Error(
                `[${name}] "${impl.name}" mutated argument #${i} (before=${before[i]}, after=${after[i]}, args=${formatArgs([...args])})`
              );
            }
          }
        }

        results.push({ name: impl.name, value });
      }

      const [first, ...rest] = results;
      for (const other of rest) {
        if (!isEqual(first.value, other.value)) {
          throw new Error(
            `[${name}] DIVERGED: "${first.name}" -> ${safeStringify(first.value)}, "${other.name}" -> ${safeStringify(other.value)} for args=${formatArgs([...args])}`
          );
        }
      }
    }),
    { numRuns }
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
