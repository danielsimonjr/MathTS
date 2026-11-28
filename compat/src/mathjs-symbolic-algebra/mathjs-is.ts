/**
 * `typeOf` / `safeNumberType` helpers for mathjs symbolic ports (#1790).
 */
import { isBigNumber, isDenseMatrix, isSparseMatrix } from '@danielsimonjr/mathts-core';
import { safeNumberType } from '@danielsimonjr/mathts-core/internal';

export { safeNumberType };

/** Same naming rules as `functions/src/utils/is.ts` `typeOf`. */
export function typeOf(x: unknown): string {
  const t = typeof x;

  if (t === 'object') {
    if (x === null) return 'null';
    if (isBigNumber(x)) return 'BigNumber';
    if (isDenseMatrix(x)) return 'DenseMatrix';
    if (isSparseMatrix(x)) return 'SparseMatrix';
    const obj = x as { constructor?: { name?: string } };
    if (obj.constructor?.name) return obj.constructor.name;

    return 'Object';
  }

  return t;
}
