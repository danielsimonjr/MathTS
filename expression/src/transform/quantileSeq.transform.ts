import { factory } from '../utils/factory.js';
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  quantileSeq: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'quantileSeq';
const dependencies = ['typed', 'quantileSeq'];

/**
 * Attach a transform function to math.quantileSeq
 * Adds a property transform containing the transform function.
 *
 * This transform changes the `dim` parameter of function quantileSeq
 * from one-based to zero based
 */
export const createQuantileSeqTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, quantileSeq }: Dependencies) => {
    // A method, `sorted` and an options object pass through. Only the last argument, when it is
    // a `dim`, changes from one-based to zero-based.
    const withDim = (...args: unknown[]): unknown =>
      quantileSeq(...args.slice(0, -1), dimToZeroBase(args[args.length - 1] as number));
    const forProb = (prob: string): Record<string, (...args: unknown[]) => unknown> => ({
      [`Array | Matrix, ${prob}`]: quantileSeq,
      [`Array | Matrix, ${prob}, number`]: withDim,
      [`Array | Matrix, ${prob}, string`]: quantileSeq,
      [`Array | Matrix, ${prob}, Object`]: quantileSeq,
      [`Array | Matrix, ${prob}, boolean`]: quantileSeq,
      [`Array | Matrix, ${prob}, string, number`]: withDim,
      [`Array | Matrix, ${prob}, Object, number`]: withDim,
      [`Array | Matrix, ${prob}, boolean, number`]: withDim,
      [`Array | Matrix, ${prob}, boolean, string`]: quantileSeq,
      [`Array | Matrix, ${prob}, boolean, string, number`]: withDim,
    });
    return typed('quantileSeq', {
      ...forProb('number | BigNumber'),
      ...forProb('Array | Matrix'),
    });

    function dimToZeroBase(dim: number): unknown {
      // TODO: find a better way, maybe lastDimToZeroBase could apply to more cases.
      return lastDimToZeroBase([[], dim])[1];
    }
  },
  { isTransformFunction: true }
);
