/**
 * The typed-array rules of the expression sandbox (#1036). The member-access receiver allowlist
 * (`customs.ts`) uses `isExactStorageArray` (real kind and exact prototype, O(1)). The result
 * guard (`safe-result.ts`) uses `isPlainNumericBuffer`, which also counts the own keys.
 */

/**
 * Reads the kind of a typed array from its internal slot (`%TypedArray%.prototype[@@toStringTag]`).
 * The getter gives `undefined` for a `Proxy` and for every value that is not a typed array, and
 * no own property or prototype change can alter its result.
 */
const typedArrayKind = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Int8Array.prototype) as object,
  Symbol.toStringTag
)!.get as (this: unknown) => string | undefined;

/** The storage kinds of a matrix of the matrix package: entries and indices. */
const STORAGE_PROTOTYPES: Readonly<Record<string, object | undefined>> = Object.assign(
  Object.create(null) as Record<string, object | undefined>,
  {
    Float64Array: Float64Array.prototype,
    Float32Array: Float32Array.prototype,
    Int32Array: Int32Array.prototype,
  }
);

/**
 * True for a real `Float64Array`, `Float32Array` or `Int32Array` (internal slot, not `instanceof`)
 * with the exact prototype of its kind (not a subclass, not a changed prototype). O(1): the
 * receiver allowlist calls it on every member access, so it does not read the own keys. Own
 * properties of a receiver are governed by `isSafeProperty` and `isSafeMethod`, as for a plain
 * object.
 */
export function isExactStorageArray(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const kind = typedArrayKind.call(value);
  if (kind === undefined) return false;
  const proto = STORAGE_PROTOTYPES[kind];
  return proto !== undefined && Object.getPrototypeOf(value) === proto;
}

/**
 * True for a plain numeric buffer: an exact storage array (see `isExactStorageArray`) with no own
 * property other than its indices (`Reflect.ownKeys`: a non-enumerable or symbol-keyed property
 * counts too). Such an array holds numbers only, so the result walk
 * has nothing to visit in it. The result guard uses this rule.
 *
 * The key count costs one pass over the indices, as the walk of a nested array does.
 */
export function isPlainNumericBuffer(value: unknown): boolean {
  return (
    isExactStorageArray(value) &&
    Reflect.ownKeys(value as object).length === (value as ArrayLike<number>).length
  );
}
