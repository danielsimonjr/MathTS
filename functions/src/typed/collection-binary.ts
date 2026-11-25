/**
 * The typed binary functions use the factories' existing collection algorithms for their
 * Array and Matrix signatures. Scalar signatures continue to dispatch directly.
 */

/**
 * True when two Units measure one quantity: one dimension, and values that are equal under
 * the scalar `equal` semantics (mathjs: `0.3 m` equals `0.1 m + 0.2 m`, and
 * `50 cm` equals `0.5 m` with BigNumber values too). Different dimensions throw the
 * mathjs error, as they do for every relational function on Units (#1552). The scalar
 * rows of `equal` and `unequal` both use it, so the two always agree (#975).
 *
 * The canonical definition lives in `./unit-compare.js`, beside the ordering helpers it
 * shares its value comparison with; this re-export keeps the historical import path.
 */
export { unitsEqual } from './unit-compare.js';

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
