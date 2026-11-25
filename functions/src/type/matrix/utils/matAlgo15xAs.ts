import { factory } from '../../../utils/factory.js';
import { deepMap } from '../../../utils/array.js';
import type { MatrixCallback, MatrixValue } from '../types.js';

const name = 'matAlgo15xAs';
const dependencies: string[] = [];

export const createMatAlgo15xAs = /* #__PURE__ */ factory(name, dependencies, () => {
  /**
   * Deeply iterates over Array items and invokes the callback function
   * f(Aij..z, b) for each nested scalar.
   * The callback function is invoked once for each item.
   *
   * C(i,j,...z) = f(Aij..z, b)
   *
   * @param {Array}    a                 The Array instance (A)
   * @param {Scalar}   b                 The Scalar value
   * @param {Function} cf                The f(Aij..z,b) operation to invoke
   * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Aij..z)
   *
   * @return {Array}                    Array (C)
   *
   * https://github.com/josdejong/mathjs/pull/346#issuecomment-97659042
   */
  return function matAlgo15xAs(
    a: unknown,
    b: MatrixValue,
    cf: MatrixCallback,
    inverse: boolean
  ): unknown {
    return inverse
      ? deepMap(a as never, (v: MatrixValue) => cf(b, v), true)
      : deepMap(a as never, (v: MatrixValue) => cf(v, b), true);
  };
});
