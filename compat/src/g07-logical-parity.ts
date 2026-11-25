/**
 * G07 (#1555): mathjs 15.3.0 logical/nullish parity on the compat instance only.
 *
 * Native typed logical functions have their own Fraction/Unit/collection rows. Compat
 * additionally binds the mathjs-shaped factories so `create(all)` throws on
 * `nullish({}, 2)` and matches mathjs 15.3.0 instance dispatch. The native `any, any`
 * row (keep a non-nullish left value, including a plain object) is unchanged.
 */
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { createAnd, createNot, createNullish, createOr, createXor } from './all-factories.js';

/** Factory-bound logical/nullish callables used on the compat instance (mathjs 15.3.0). */
export type G07LogicalFns = {
  nullish: (...args: unknown[]) => unknown;
  not: (...args: unknown[]) => unknown;
  and: (...args: unknown[]) => unknown;
  or: (...args: unknown[]) => unknown;
  xor: (...args: unknown[]) => unknown;
};

/** Factory-built logical surface matching mathjs 15.3.0. */
export function createG07LogicalParity(): G07LogicalFns {
  const typed = factory_mathjsCompat.createCompatTyped();
  const matrix = mathFunctions.matrix;
  const not = createNot({ typed }) as G07LogicalFns['not'];
  const and = createAnd({
    typed,
    matrix,
    zeros: mathFunctions.zeros,
    not,
  }) as G07LogicalFns['and'];
  const or = createOr({
    typed,
    matrix,
    DenseMatrix,
  }) as G07LogicalFns['or'];
  const xor = createXor({
    typed,
    matrix,
    DenseMatrix,
    SparseMatrix,
  }) as G07LogicalFns['xor'];
  const nullish = createNullish({
    typed,
    matrix,
    size: mathFunctions.size,
    flatten: mathFunctions.flatten,
    deepEqual: mathFunctions.deepEqual,
  }) as G07LogicalFns['nullish'];
  return { nullish, not, and, or, xor };
}
