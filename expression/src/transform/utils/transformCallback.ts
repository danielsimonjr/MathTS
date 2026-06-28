import { factory } from '../../utils/factory.js';

import { TypedFunction } from '../../types.js';

type AnyFunction = (...args: unknown[]) => unknown;
type TypedWithGuard = TypedFunction & { isTypedFunction(fn: unknown): boolean };

const name = 'transformCallback';
const dependencies = ['typed'];

export const createTransformCallback = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed }: { typed: TypedFunction }) => {
    /**
     * Transforms the given callback function based on its type and number of arrays.
     *
     * @param {Function} callback - The callback function to transform.
     * @param {number} numberOfArrays - The number of arrays to pass to the callback function.
     * @returns {*} - The transformed callback function.
     */
    return function (callback: unknown, numberOfArrays: number): unknown {
      if ((typed as TypedWithGuard).isTypedFunction(callback)) {
        return _transformTypedCallbackFunction(callback, numberOfArrays);
      } else {
        const fn = callback as AnyFunction;
        return _transformCallbackFunction(fn, fn.length, numberOfArrays);
      }
    };

    /**
     * Transforms the given typed callback function based on the number of arrays.
     *
     * @param {Function} typedFunction - The typed callback function to transform.
     * @param {number} numberOfArrays - The number of arrays to pass to the callback function.
     * @returns {*} - The transformed callback function.
     */
    function _transformTypedCallbackFunction(
      typedFunction: unknown,
      numberOfArrays: number
    ): unknown {
      const fn = typedFunction as TypedFunction;
      const signatures: Record<string, unknown> = Object.fromEntries(
        Object.entries(fn.signatures).map(([signature, callbackFunction]): [string, unknown] => {
          const numberOfCallbackInputs = signature.split(',').length;
          if ((typed as TypedWithGuard).isTypedFunction(callbackFunction)) {
            return [signature, _transformTypedCallbackFunction(callbackFunction, numberOfArrays)];
          } else {
            return [
              signature,
              _transformCallbackFunction(callbackFunction, numberOfCallbackInputs, numberOfArrays),
            ];
          }
        })
      );

      if (typeof fn.name === 'string') {
        return typed(fn.name, signatures);
      } else {
        return typed(signatures);
      }
    }
  }
);

/**
 * Transforms the callback function based on the number of callback inputs and arrays.
 * There are three cases:
 * 1. The callback function has N arguments.
 * 2. The callback function has N+1 arguments.
 * 3. The callback function has 2N+1 arguments.
 *
 * @param {Function} callbackFunction - The callback function to transform.
 * @param {number} numberOfCallbackInputs - The number of callback inputs.
 * @param {number} numberOfArrays - The number of arrays.
 * @returns {Function} The transformed callback function.
 */
function _transformCallbackFunction(
  callbackFunction: unknown,
  numberOfCallbackInputs: number,
  numberOfArrays: number
): unknown {
  const fn = callbackFunction as AnyFunction;
  if (numberOfCallbackInputs === numberOfArrays) {
    return callbackFunction;
  } else if (numberOfCallbackInputs === numberOfArrays + 1) {
    return function (...args: unknown[]) {
      const vals = args.slice(0, numberOfArrays);
      const idx = _transformDims(args[numberOfArrays]);
      return fn(...vals, idx);
    };
  } else if (numberOfCallbackInputs > numberOfArrays + 1) {
    return function (...args: unknown[]) {
      const vals = args.slice(0, numberOfArrays);
      const idx = _transformDims(args[numberOfArrays]);
      const rest = args.slice(numberOfArrays + 1);
      return fn(...vals, idx, ...rest);
    };
  } else {
    return callbackFunction;
  }
}

/**
 * Transforms the dimensions by adding 1 to each dimension.
 *
 * @param {Array} dims - The dimensions to transform.
 * @returns {Array} The transformed dimensions.
 */
function _transformDims(dims: unknown): number[] {
  return (dims as number[]).map((dim: number) => dim + 1);
}
