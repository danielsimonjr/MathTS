/**
 * The collection rows of the comparison functions (#975, #1307).
 *
 * `equal`, `unequal`, `smaller`, `larger`, `smallerEq`, `largerEq` and `compare` of the typed
 * layer take scalars. The mathjs ports of the factory layer take an Array or a matrix and give
 * the mathjs values and the mathjs result storage. The typed functions get one row per
 * `<collection>, any` and `any, <collection>` pair, and each row calls the factory function.
 * A scalar pair never reaches these rows: typed-function ranks `any` last, so the scalar rows
 * keep their dispatch and their speed.
 *
 * The factory layer imports the typed layer, so the typed layer cannot import the factory
 * functions. The factory layer registers its scope once, when it defines the functions. This
 * module is internal: it is not re-exported.
 */

/** A comparison of two operands. */
export type RelationalFn = (a: unknown, b: unknown) => unknown;

const registered: { scope?: Record<string, unknown> } = {};

/**
 * Register the scope that holds the factory comparison functions. Called once by the factory
 * layer. The scope is read at call time, so a function that the factory layer assigns later
 * is seen.
 *
 * @param scope - The factory scope object (`equal`, `compare`, `larger`, ... are its keys).
 */
export function registerCollectionRelational(scope: object): void {
  registered.scope = scope as Record<string, unknown>;
}

/**
 * The factory comparison function of that name.
 *
 * @param name - Function name, for example `'larger'`.
 * @returns The factory function.
 * @throws Error when the factory layer has not registered it.
 */
export function collectionRelational(name: string): RelationalFn {
  const fn = registered.scope?.[name];
  if (typeof fn !== 'function') {
    throw new Error(`${name}(collection): the factory function is not registered`);
  }
  return fn as RelationalFn;
}

/**
 * The six collection rows of one comparison function, for the signature object of the typed
 * function: `Array`, `DenseMatrix` and `SparseMatrix`, each against `any`, in both orders.
 *
 * @param name - Function name, for example `'larger'`.
 * @param whenNullish - The result when an operand is `null` or `undefined` (a collection is
 *   never nullish). Leave it out to let the factory function decide, as mathjs does.
 * @returns The signature rows.
 */
export function collectionRelationalRows(
  name: string,
  whenNullish?: unknown
): Record<string, RelationalFn> {
  const call: RelationalFn = (a, b) => {
    if (whenNullish !== undefined && (a == null || b == null)) return whenNullish;
    return collectionRelational(name)(a, b);
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
