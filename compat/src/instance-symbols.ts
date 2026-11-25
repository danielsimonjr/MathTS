import { BigNumber } from './bignumber.js';
import { Complex, Fraction, Range } from '@danielsimonjr/mathts-core';
import {
  DimensionError,
  IndexError,
  isObjectWrappingMap,
} from '@danielsimonjr/mathts-core/internal';
import { factory_mathjsCompat, Help, num, den } from '@danielsimonjr/mathts-functions';
import { isDenseMatrix, isSparseMatrix, isMatrix } from '@danielsimonjr/mathts-matrix';
import { complex } from './shims.js';
import packageMetadata from '../package.json' with { type: 'json' };

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

type ComplexConstructor = typeof Complex & {
  new (value?: unknown, imaginary?: number): Complex;
};

const CompatComplex = new Proxy(Complex, {
  construct(target, args, newTarget) {
    const value = (complex as (...args: unknown[]) => Complex)(...args);
    return Reflect.construct(target, [value.re, value.im], newTarget);
  },
}) as ComplexConstructor;

type NativeCompatSymbols = {
  Help: typeof Help;
  BigNumber: typeof BigNumber;
  Complex: ComplexConstructor;
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
  // Use the same constructors whose values are returned by the compatibility functions.
  BigNumber,
  Complex: CompatComplex,
  Fraction,
  Range,
  Matrix,
  DimensionError,
  IndexError,
  factory,
  PI: Math.PI,
  E: Math.E,
  false: false,
  true: true,
  null: null,
  version: packageMetadata.version,
  num,
  den,
  ...compatChecks,
  isDenseMatrix: (value: unknown) => isDenseMatrix(value) || checks.isDenseMatrix(value),
  isSparseMatrix: (value: unknown) => isSparseMatrix(value) || checks.isSparseMatrix(value),
  isCollection: (value: unknown) => checks.isArray(value) || value instanceof Matrix,
  isObjectWrappingMap,
};
