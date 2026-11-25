/**
 * The typed binary functions use the factories' existing collection algorithms for their
 * Array and Matrix signatures. Scalar signatures continue to dispatch directly.
 */
import {
  BigNumber,
  Fraction,
  equal as coreEqual,
  isBigNumber,
  isComplex,
  isFraction,
  number as scalarNumber,
  type NumericScalar,
} from '@danielsimonjr/mathts-core';

type UnitSiLike = {
  equalBase(o: unknown): boolean;
  value: unknown;
  toSI(): { value: unknown };
};

/**
 * SI magnitude of a Unit, including affine offset (Kelvin for degC/degF).
 * Prefix-only and scale-only units already store SI in `.value`; `toSI()` is
 * exact for BigNumber and Fraction (no round-trip through `number`).
 */
export function unitSiValue(u: unknown): unknown {
  const unit = u as UnitSiLike;
  // Duck-typed units in tests (and compareUnits) may only expose `.value`.
  if (typeof unit.toSI === 'function') return unit.toSI().value;
  return unit.value;
}

/**
 * True when two Units measure one quantity: one dimension, and values that are equal under the
 * tolerance of the number rows of `equal` (mathjs: `0.3 m` equals `0.1 m + 0.2 m`). Affine
 * temperatures (`0 degC` and `32 degF`) compare as absolute SI, not as scale-only `.value`.
 * The scalar rows of `equal` and `unequal` both use it, so the two always agree (#975).
 *
 * @param a - Left Unit.
 * @param b - Right Unit.
 * @returns Whether the Units are equal.
 */
export function unitsEqual(a: unknown, b: unknown): boolean {
  const x = a as UnitSiLike;
  if (!x.equalBase(b)) return false;
  return coreEqual(unitSiValue(a) as NumericScalar, unitSiValue(b) as NumericScalar);
}

const COMPLEX_ORDER_ERR = 'No ordering relation is defined for complex numbers';

/**
 * Ordering sign for two Unit values in the same dimension (after `equalBase`).
 * Throws when either value is Complex — ordering complex scalars is undefined.
 */
export function unitValuesCompare(va: unknown, vb: unknown): -1 | 0 | 1 {
  if (isComplex(va) || isComplex(vb)) {
    throw new Error(COMPLEX_ORDER_ERR);
  }
  if (isFraction(va) && isFraction(vb)) {
    const c = Fraction.compare(va, vb);
    return c < 0 ? -1 : c > 0 ? 1 : 0;
  }
  if (typeof va === 'bigint' && typeof vb === 'bigint') {
    return va > vb ? 1 : va < vb ? -1 : 0;
  }
  if (isBigNumber(va) && isBigNumber(vb)) {
    if (va.isNaN() && vb.isNaN()) return 0;
    if (va.isNaN()) return 1;
    if (vb.isNaN()) return -1;
    const c = BigNumber.compare(va, vb);
    return c < 0 ? -1 : c > 0 ? 1 : 0;
  }
  if (typeof va === 'number' && typeof vb === 'number') {
    if (Number.isNaN(va) && Number.isNaN(vb)) return 0;
    if (Number.isNaN(va)) return 1;
    if (Number.isNaN(vb)) return -1;
    if (coreEqual(va, vb)) return 0;
    return va > vb ? 1 : va < vb ? -1 : 0;
  }
  const nx = scalarNumber(va as NumericScalar);
  const ny = scalarNumber(vb as NumericScalar);
  if (Number.isNaN(nx) && Number.isNaN(ny)) return 0;
  if (Number.isNaN(nx)) return 1;
  if (Number.isNaN(ny)) return -1;
  if (coreEqual(nx, ny)) return 0;
  return nx > ny ? 1 : nx < ny ? -1 : 0;
}

/** A binary operation. */
export type BinaryFn = (a: unknown, b: unknown) => unknown;

const registered: { scope?: Record<string, unknown> } = {};

/**
 * Register the scope that holds the factory functions. Called once by the factory
 * layer. The scope is read at call time, so a function that the factory layer assigns later
 * is seen.
 *
 * @param scope - The factory scope object (`equal`, `compare`, `larger`, ... are its keys).
 */
export function registerCollectionBinary(scope: object): void {
  registered.scope = scope as Record<string, unknown>;
}

/**
 * The factory binary function of that name.
 *
 * @param name - Function name, for example `'larger'`.
 * @returns The factory function.
 * @throws Error when the factory layer has not registered it.
 */
export function collectionBinary(name: string): BinaryFn {
  const fn = registered.scope?.[name];
  if (typeof fn !== 'function') {
    throw new Error(`${name}(collection): the factory function is not registered`);
  }
  return fn as BinaryFn;
}

/**
 * The six collection rows of one binary function, for the signature object of the typed
 * function: `Array`, `DenseMatrix` and `SparseMatrix`, each against `any`, in both orders.
 *
 * @param name - Function name, for example `'larger'`.
 * @param whenNullish - The result when an operand is `null` or `undefined` (a collection is
 *   never nullish). Leave it out to let the factory function decide, as mathjs does.
 * @returns The signature rows.
 */
export function collectionBinaryRows(
  name: string,
  whenNullish?: unknown
): Record<string, BinaryFn> {
  const call: BinaryFn = (a, b) => {
    if (whenNullish !== undefined && (a == null || b == null)) return whenNullish;
    return collectionBinary(name)(a, b);
  };
  return {
    'Array, any': call,
    'any, Array': call,
    'DenseMatrix, any': call,
    'any, DenseMatrix': call,
    'SparseMatrix, any': call,
    'any, SparseMatrix': call,
  };
}
