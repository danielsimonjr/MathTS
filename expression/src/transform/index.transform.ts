import { isArray, isBigInt, isBigNumber, isMatrix, isNumber, isRange } from '../utils/is.js';
import { factory } from '../utils/factory.js';

interface IndexClass {
  new (...args: unknown[]): unknown;
  apply(instance: unknown, args: unknown[]): void;
}

interface Dependencies {
  Index: IndexClass;
  getMatrixDataType: (matrix: unknown) => string;
}

const name = 'index';
const dependencies = ['Index', 'getMatrixDataType'];

export const createIndexTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ Index, getMatrixDataType }: Dependencies) => {
    /**
     * Attach a transform function to math.index
     * Adds a property transform containing the transform function.
     *
     * This transform creates a one-based index instead of a zero-based index
     */
    return function indexTransform(...args: unknown[]): unknown {
      const transformedArgs: unknown[] = [];
      for (let i = 0, ii = args.length; i < ii; i++) {
        let arg = args[i];

        // change from one-based to zero based, convert BigNumber to number and leave Array of Booleans as is
        if (isRange(arg)) {
          arg.start--;
          arg.end -= arg.step > 0 ? 0 : 2;
        } else if (arg && (arg as { isSet?: boolean }).isSet === true) {
          arg = (arg as { map(cb: (v: number) => number): unknown }).map(function (
            v: number
          ): number {
            return v - 1;
          });
        } else if (isArray(arg) || isMatrix(arg)) {
          if (getMatrixDataType(arg) !== 'boolean') {
            arg = (arg as { map(cb: (v: number) => number): unknown }).map(function (
              v: number
            ): number {
              return v - 1;
            });
          }
        } else if (isNumber(arg) || isBigInt(arg)) {
          arg--;
        } else if (isBigNumber(arg)) {
          arg = (arg as unknown as { toNumber(): number }).toNumber() - 1;
        } else if (typeof arg === 'string') {
          // leave as is
        } else {
          throw new TypeError(
            'Dimension must be an Array, Matrix, number, bigint, string, or Range'
          );
        }

        transformedArgs[i] = arg;
      }

      // ES6 classes cannot be Function.apply'd into an instance (the old
      // mathjs-JS idiom) — spread into the constructor instead.
      return new Index(...transformedArgs);
    };
  },
  { isTransformFunction: true }
);
