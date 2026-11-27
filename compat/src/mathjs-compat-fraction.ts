/**
 * mathjs 15.3.0 `fraction()` factory: returns fraction.js instances (#1779).
 */
import type { BigNumber } from '@danielsimonjr/mathts-core';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { isDenseMatrix, isSparseMatrix } from '@danielsimonjr/mathts-matrix';
import { isBigNumberLike, isOwnBigNumber } from './mathjs-parity-g02.js';
import {
  isMathjsFraction,
  mathjsFractionClass,
  type MathjsFraction,
} from './mathjs-fraction-class.js';

const Fraction = mathjsFractionClass;

type UnitLike = { value: unknown; clone(): { value: unknown } };

function convertUnitValue(convert: (value: unknown) => unknown, unit: UnitLike): UnitLike {
  const copy = unit.clone() as UnitLike;
  copy.value = convert(unit.value);
  return copy;
}

function mapCollection(value: unknown, convert: (entry: unknown) => unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => mapCollection(entry, convert));
  }
  if (isDenseMatrix(value) || isSparseMatrix(value)) {
    return (value as { map: (callback: (entry: unknown) => unknown) => unknown }).map((entry) =>
      mapCollection(entry, convert)
    );
  }
  const maybeMatrix = value as { map?: (callback: (entry: unknown) => unknown) => unknown };
  if (typeof maybeMatrix.map === 'function') {
    return maybeMatrix.map((entry) => mapCollection(entry, convert));
  }
  return convert(value);
}

const typed = factory_mathjsCompat.createCompatTyped();

/**
 * Typed `fraction` matching mathjs 15.3.0: fraction.js in/out, integer two-arg
 * validation, and collection mapping.
 */
export const compatFractionFn = typed('fraction', {
  number: (value: number) => {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error(`${value} cannot be represented as a fraction`);
    }
    return new Fraction(value) as MathjsFraction;
  },

  string: (value: string) => new Fraction(value) as MathjsFraction,

  'number, number': (numerator: number, denominator: number) =>
    new Fraction(numerator, denominator) as MathjsFraction,

  'bigint, bigint': (numerator: bigint, denominator: bigint) =>
    new Fraction(numerator, denominator) as MathjsFraction,

  null: () => new Fraction(0) as MathjsFraction,

  BigNumber: (value: BigNumber) => new Fraction(value.toString()) as MathjsFraction,

  bigint: (value: bigint) => new Fraction(value.toString()) as MathjsFraction,

  Fraction: (value: MathjsFraction) => value,

  Unit: typed.referToSelf(
    (self: (x: unknown) => unknown) => (value: UnitLike) => convertUnitValue(self, value)
  ),

  Object: (value: { n?: unknown; d?: unknown; s?: unknown }) =>
    new Fraction(value as ConstructorParameters<typeof Fraction>[0]) as MathjsFraction,

  'Array | Matrix': typed.referToSelf(
    (self: (x: unknown) => unknown) => (value: unknown) => mapCollection(value, self)
  ),

  '': () => new Fraction(0) as MathjsFraction,

  undefined: () => new Fraction(0) as MathjsFraction,
});

const fractionTyped = compatFractionFn;

function fractionDispatch(this: unknown, ...args: unknown[]): unknown {
  if (args.length === 1 && isMathjsFraction(args[0])) {
    return args[0];
  }
  if (args.length === 1 && isBigNumberLike(args[0]) && !isOwnBigNumber(args[0])) {
    return new Fraction((args[0] as { toString(): string }).toString()) as MathjsFraction;
  }
  return Reflect.apply(fractionTyped, this, args);
}

/** mathjs `fraction` export with immutability passthrough and empty signatures. */
export const compatFractionFnExport = Object.assign(
  fractionDispatch,
  fractionTyped
) as CompatFractionFn;

/** mathjs `fraction` export with the extra compat empty signatures preserved on the object. */
export type CompatFractionFn = typeof fractionTyped & {
  (numerator?: number | string | MathjsFraction, denominator?: number): MathjsFraction;
};
