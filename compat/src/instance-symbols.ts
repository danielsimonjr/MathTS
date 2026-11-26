import { BigNumber } from './bignumber.js';
import { Complex, Fraction, Range, isNumber, isUnit } from '@danielsimonjr/mathts-core';
import {
  DimensionError,
  IndexError,
  isObjectWrappingMap,
} from '@danielsimonjr/mathts-core/internal';
import { factory_mathjsCompat, Help, num, den } from '@danielsimonjr/mathts-functions';
import { isDenseMatrix, isSparseMatrix, isMatrix } from '@danielsimonjr/mathts-matrix';
import { callableWithoutNew, newOperatorGuard } from './constructors-without-new.js';
import { mathjsComplexProxy, type MathjsComplexConstructor } from './mathjs-complex-class.js';
import packageMetadata from '../package.json' with { type: 'json' };

/**
 * The mathjs version the compat instance emulates (#1581). Bump it only in the same
 * commit that moves the `mathjs` devDependency (the oracle pin, S1 of the parity plan).
 */
export const MATHJS_PARITY_VERSION = '15.3.0';

/** The compat package's own version, under a name mathjs does not use (#1581). */
export const compatVersion: string = packageMetadata.version;

const { checks, constructors, factory } = factory_mathjsCompat;

/** Common base for testing whether a value is any supported matrix representation. */
class Matrix {
  static [Symbol.hasInstance](value: unknown): boolean {
    return (
      Function.prototype[Symbol.hasInstance].call(this, value) ||
      isMatrix(value) ||
      checks.isMatrix(value)
    );
  }
}

/** mathjs callable classes: `Complex(...)` and `BigNumber(...)` build an instance (#1774). */
const CompatBigNumber = callableWithoutNew(BigNumber) as unknown as BigNumberConstructor;

type BigNumberConstructor = typeof BigNumber & {
  (value?: number | string | bigint | boolean | null): BigNumber;
};

const CompatComplex = mathjsComplexProxy(Complex, { isNumber, isUnit });

/**
 * mathjs guard classes: a new-less call throws the mathjs SyntaxError, while
 * `new X(...)` constructs normally (#1774). Index, Range, Spa and the error
 * classes follow mathjs 15.3.0's `if (!(this instanceof X)) throw` convention.
 */
const CompatIndex = newOperatorGuard(constructors.Index);
const CompatRange = newOperatorGuard(Range);
const CompatSpa = newOperatorGuard(constructors.Spa);
const CompatArgumentsError = newOperatorGuard(constructors.ArgumentsError);
const CompatDimensionError = newOperatorGuard(DimensionError);

type NativeCompatSymbols = {
  Help: typeof Help;
  BigNumber: BigNumberConstructor;
  Complex: MathjsComplexConstructor;
  Fraction: typeof Fraction;
  Range: typeof Range;
  Matrix: typeof Matrix;
  DimensionError: typeof DimensionError;
  IndexError: typeof IndexError;
  factory: typeof factory_mathjsCompat.factory;
  PI: number;
  E: number;
  false: false;
  true: true;
  null: null;
  version: string;
  num: typeof num;
  den: typeof den;
  isDenseMatrix(value: unknown): boolean;
  isSparseMatrix(value: unknown): boolean;
  isCollection(value: unknown): boolean;
  isObjectWrappingMap: typeof isObjectWrappingMap;
};

const checkNames = [
  'isArray',
  'isString',
  'isBoolean',
  'isNull',
  'isUndefined',
  'isUnit',
  'isBigInt',
  'isFunction',
  'isObject',
  'isDate',
  'isRegExp',
  'isMap',
  'isRange',
  'isChain',
  'isHelp',
  'isResultSet',
  'isIndex',
  'isPartitionedMap',
  'isNode',
  'isAccessorNode',
  'isArrayNode',
  'isAssignmentNode',
  'isBlockNode',
  'isConditionalNode',
  'isConstantNode',
  'isFunctionAssignmentNode',
  'isFunctionNode',
  'isIndexNode',
  'isObjectNode',
  'isOperatorNode',
  'isParenthesisNode',
  'isRangeNode',
  'isRelationalNode',
  'isSymbolNode',
] as const;

type CompatChecks = Pick<typeof factory_mathjsCompat.checks, (typeof checkNames)[number]>;

const compatChecks = Object.fromEntries(
  checkNames.map((name) => [name, checks[name]])
) as CompatChecks;

/** Mathjs host API names that are independent of a particular instance. */
export const instanceSymbols: typeof factory_mathjsCompat.constructors &
  NativeCompatSymbols &
  CompatChecks = {
  ...constructors,
  Help,
  Index: CompatIndex,
  Spa: CompatSpa,
  ArgumentsError: CompatArgumentsError,
  // Use the same constructors whose values are returned by the compatibility functions.
  BigNumber: CompatBigNumber,
  Complex: CompatComplex,
  Fraction,
  Range: CompatRange,
  Matrix,
  DimensionError: CompatDimensionError,
  IndexError,
  factory,
  PI: Math.PI,
  E: Math.E,
  false: false,
  true: true,
  null: null,
  version: MATHJS_PARITY_VERSION,
  num,
  den,
  ...compatChecks,
  isDenseMatrix: (value: unknown) => isDenseMatrix(value) || checks.isDenseMatrix(value),
  isSparseMatrix: (value: unknown) => isSparseMatrix(value) || checks.isSparseMatrix(value),
  isCollection: (value: unknown) => checks.isArray(value) || value instanceof Matrix,
  isObjectWrappingMap,
};
