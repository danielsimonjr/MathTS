/**
 * Patched mathjs `addScalar` / `subtractScalar` factory callables (#1787).
 * Imported by `index.ts` and shim routing only — not re-exported on the public package surface.
 */

import {
  addScalar as _addScalar,
  subtractScalar as _factorySubtractScalar,
} from '@danielsimonjr/mathts-functions';
import { BigNumber as CompatBigNumber, promoteBooleanScalarsForBigNumber } from './bignumber.js';
import { createFactoryScalar1787Wrapper } from './mathjs-parity-1787-arithmetic.js';
import {
  mathjsBigIntFractionPair,
  mathjsFactoryFractionAdd,
  mathjsFractionSub,
} from './mathjs-fraction-scalar-pairs.js';
import { withPublicFactoryScalar } from './mathjs-parity-errors.js';

type BinaryArithmetic = (...args: unknown[]) => unknown;

/** Factory `addScalar` with Decimal.js order, bigint×Fraction, and boolean×BigNumber promotion. */
export const factoryAddScalar1787 = createFactoryScalar1787Wrapper(
  'add',
  _addScalar as BinaryArithmetic,
  mathjsBigIntFractionPair,
  (args) =>
    promoteBooleanScalarsForBigNumber(args, CompatBigNumber, { promoteTrailingBoolean: true }),
  mathjsFactoryFractionAdd
);

/** Factory `subtractScalar` with the same pre-call routing as mathjs 15.3.0. */
export const factorySubtractScalar1787 = createFactoryScalar1787Wrapper(
  'sub',
  _factorySubtractScalar as BinaryArithmetic,
  mathjsBigIntFractionPair,
  (args) =>
    promoteBooleanScalarsForBigNumber(args, CompatBigNumber, { promoteTrailingBoolean: true }),
  mathjsFractionSub
);

/** Public `add` scalar leg that wraps factory errors like mathjs `addScalar`. */
export const publicAddScalar = withPublicFactoryScalar('add', 'addScalar', factoryAddScalar1787);

/** Public `subtract` scalar leg that wraps factory errors like mathjs `subtractScalar`. */
export const publicSubtractScalar = withPublicFactoryScalar(
  'subtract',
  'subtractScalar',
  factorySubtractScalar1787
);
