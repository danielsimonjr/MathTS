import type { MathArray, Matrix, MathNumericType } from '../../types/index.js';
import type { IndexInterface } from '../type/matrix/types.js';

type Index = IndexInterface;

export interface FlattenSetPairDeps {
  size: (arr: MathArray | Matrix) => number[];
  subset: (arr: number[], index: Index) => number;
  Index: new (i: number) => Index;
  flatten: (a: MathNumericType[]) => MathNumericType[];
}

/**
 * Shared empty-set flatten preamble for multiset union and symmetric difference.
 * When both sides are non-empty, flattens each operand and invokes `combine` once.
 */
export function flattenSetPair(
  a1: MathArray | Matrix,
  a2: MathArray | Matrix,
  deps: FlattenSetPairDeps,
  combine: (b1: MathNumericType[], b2: MathNumericType[]) => MathNumericType[] | Matrix
): MathNumericType[] | Matrix {
  const { size, subset, Index, flatten } = deps;
  if (subset(size(a1), new Index(0)) === 0) {
    return flatten(a2 as MathNumericType[]);
  }
  if (subset(size(a2), new Index(0)) === 0) {
    return flatten(a1 as MathNumericType[]);
  }
  const b1 = flatten(a1 as MathNumericType[]);
  const b2 = flatten(a2 as MathNumericType[]);
  return combine(b1, b2);
}
