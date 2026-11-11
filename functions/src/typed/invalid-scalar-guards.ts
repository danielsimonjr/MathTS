/**
 * Guards for typed `add` / `multiply`: reject operands that must not be coerced
 * (nullish, strings, plain objects, dates, …). Typed-function conversions (e.g. string→number)
 * run before signature tests, so explicit `string, any` signatures do not fire; these
 * checks run before dispatch instead.
 *
 * Two numbers skip the scan. That is the hot path (`add(1, 2)`); the checks exist
 * for values typed-function would convert or report as a missing argument.
 */
import { BigNumber, Complex, Dual, Fraction } from '@danielsimonjr/mathts-core';
import { Matrix } from '@danielsimonjr/mathts-matrix';

/** Runtime type label used in `add` / `multiply` TypeErrors (`null`, `string`, `[object Date]`, …). */
export function formatUnexpectedArgumentType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return Object.prototype.toString.call(value);
  return typeof value;
}

/** Throw a `TypeError` that names `fn`, the runtime type of `value`, and `index`. */
export function unexpectedArgumentType(fn: string, value: unknown, index: number): never {
  throw new TypeError(
    `${fn}: unexpected type ${formatUnexpectedArgumentType(value)} at index ${index}`
  );
}

function isAllowedObject(value: object): boolean {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return true;
  if (
    value instanceof Complex ||
    value instanceof Fraction ||
    value instanceof BigNumber ||
    value instanceof Dual ||
    value instanceof Matrix
  ) {
    return true;
  }
  const proto = (
    value as { constructor?: { prototype?: { isUnit?: boolean; isMatrix?: boolean } } }
  ).constructor?.prototype;
  return proto?.isUnit === true || proto?.isMatrix === true;
}

/**
 * Reject binary operands that typed-function would convert or mis-dispatch.
 * Numbers, bigints, and booleans pass. Objects must be an array, a typed array,
 * or a Complex, Fraction, BigNumber, Dual, Unit, or matrix.
 */
export function rejectInvalidBinaryScalars(fn: string, args: unknown[]): void {
  const n = Math.min(args.length, 2);
  for (let i = 0; i < n; i++) {
    const v = args[i];
    if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') continue;
    if (typeof v === 'object' && v !== null && isAllowedObject(v)) continue;
    unexpectedArgumentType(fn, v, i);
  }
}

/**
 * Run invalid-scalar checks before typed-function dispatch (incl. conversions).
 * Two numbers skip the scan and call `typedFn` directly.
 */
export function withBinaryScalarGuards<T extends (...args: never[]) => unknown>(
  name: string,
  typedFn: T
): T {
  const guarded = function (this: unknown, ...args: Parameters<T>) {
    const a = args[0];
    const b = args[1];
    if (typeof a === 'number' && typeof b === 'number') {
      return typedFn.apply(this, args);
    }
    rejectInvalidBinaryScalars(name, args as unknown[]);
    return typedFn.apply(this, args);
  };
  Object.defineProperty(guarded, 'name', { value: name });
  return Object.assign(guarded, typedFn) as T;
}
