import { findTypedImpl } from '../../../utils/typed-impl.js';
import type { TypedFunction } from '../../../core/function/typed.js';

type NumberBin = (a: number, b: number) => number;
type NumberEqual = (a: number, b: number) => boolean;

/** The `number, number` implementations a triangular solver calls in its number fast path. */
export type SolveNumberOps = {
  div: NumberBin;
  mul: NumberBin;
  sub: NumberBin;
  equalScalar: NumberEqual;
};

/** The scalar factory dependencies that `createSolveNumberOps` resolves. */
export interface SolveScalarDependencies {
  divideScalar: unknown;
  multiplyScalar: unknown;
  subtractScalar: unknown;
  equalScalar: unknown;
}

/**
 * Make the getter of the `number, number` scalar implementations for one solver instance.
 *
 * The getter resolves the four implementations on its first call and keeps the result for the
 * instance. The getter returns `null` when one dependency has no `number, number` signature.
 * Then the solver keeps its generic path.
 *
 * @param typed - The typed-function instance of the solver factory.
 * @param scalars - The scalar dependencies of the solver factory.
 * @returns A getter of the resolved implementations, or of `null`.
 *
 * @example
 * ```ts
 * const getSolveNumberOps = createSolveNumberOps(typed, {
 *   divideScalar,
 *   multiplyScalar,
 *   subtractScalar,
 *   equalScalar,
 * });
 * const ops = getSolveNumberOps(); // { div, mul, sub, equalScalar } or null
 * ```
 */
export function createSolveNumberOps(
  typed: TypedFunction,
  scalars: SolveScalarDependencies
): () => SolveNumberOps | null {
  let cachedSolveOps: SolveNumberOps | null | undefined;

  return function getSolveNumberOps(): SolveNumberOps | null {
    if (cachedSolveOps === undefined) {
      const nn = ['number', 'number'];
      const div = findTypedImpl<[number, number], number>(typed, scalars.divideScalar, nn);
      const mul = findTypedImpl<[number, number], number>(typed, scalars.multiplyScalar, nn);
      const sub = findTypedImpl<[number, number], number>(typed, scalars.subtractScalar, nn);
      const equalNum = findTypedImpl<[number, number], boolean>(typed, scalars.equalScalar, nn);
      cachedSolveOps =
        div && mul && sub && equalNum ? { div, mul, sub, equalScalar: equalNum } : null;
    }
    return cachedSolveOps;
  };
}
