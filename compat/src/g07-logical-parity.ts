/**
 * G07 (#1555): mathjs 15.3.0 logical/nullish parity on the compat instance only.
 *
 * Native `@danielsimonjr/mathts-functions` typed logical functions are unchanged; compat
 * binds the mathjs-shaped factory implementations (element-wise `nullish`, Unit value
 * truthiness, TypeError on plain objects).
 */
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { createAnd, createNot, createNullish, createOr, createXor } from './all-factories.js';

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
