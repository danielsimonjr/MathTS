import type { TypedFunction } from '../core/function/typed.js';

/**
 * The implementation `typed` dispatches to for `signature`, resolved once so that a hot loop can
 * call it without per-call dispatch.
 *
 * `typed.find` throws when `fn` is not a typed function or has no such signature, and a factory
 * dependency can be replaced by either. Then this returns `null` and the caller keeps its
 * generic path, which dispatches per call exactly as before.
 */
export function findTypedImpl<A extends unknown[], R>(
  typed: TypedFunction,
  fn: unknown,
  signature: string[]
): ((...args: A) => R) | null {
  try {
    return typed.find(fn as TypedFunction, signature) as unknown as (...args: A) => R;
  } catch {
    return null;
  }
}

/** The four `number, number` arithmetic implementations of a number fast path, plus one unary one. */
export type NumberFieldOps<K extends string> = {
  add: (a: number, b: number) => number;
  mul: (a: number, b: number) => number;
  sub: (a: number, b: number) => number;
  div: (a: number, b: number) => number;
} & { [P in K]: (a: number) => number };

/** The scalar factory dependencies that `createNumberFieldOps` resolves. */
export interface NumberFieldScalars {
  addScalar: unknown;
  multiplyScalar: unknown;
  subtractScalar: unknown;
  divideScalar: unknown;
}

/**
 * Make the getter of the number fast-path operations of one factory instance: `add`, `mul`,
 * `sub` and `div` with the signature `number, number`, and one unary `number` operation under
 * the key `unaryKey`.
 *
 * The getter resolves the operations on its first call and keeps the result for the instance.
 * It returns `null` when one dependency has no such signature. Then the caller keeps its
 * generic path.
 *
 * @param typed - The typed-function instance of the factory.
 * @param scalars - The scalar dependencies of the factory.
 * @param unaryKey - The key of the unary operation in the result, such as `abs`.
 * @param unaryFn - The typed function of the unary operation.
 * @returns A getter of the resolved operations, or of `null`.
 */
export function createNumberFieldOps<K extends string>(
  typed: TypedFunction,
  scalars: NumberFieldScalars,
  unaryKey: K,
  unaryFn: unknown
): () => NumberFieldOps<K> | null {
  let cached: NumberFieldOps<K> | null | undefined;

  return function getNumberFieldOps(): NumberFieldOps<K> | null {
    if (cached === undefined) {
      const nn = ['number', 'number'];
      const add = findTypedImpl<[number, number], number>(typed, scalars.addScalar, nn);
      const mul = findTypedImpl<[number, number], number>(typed, scalars.multiplyScalar, nn);
      const sub = findTypedImpl<[number, number], number>(typed, scalars.subtractScalar, nn);
      const div = findTypedImpl<[number, number], number>(typed, scalars.divideScalar, nn);
      const unary = findTypedImpl<[number], number>(typed, unaryFn, ['number']);
      cached =
        add && mul && sub && div && unary
          ? ({ add, mul, sub, div, [unaryKey]: unary } as NumberFieldOps<K>)
          : null;
    }
    return cached;
  };
}
