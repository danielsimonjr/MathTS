/**
 * Per-instance `Unit.typeConverters` for mathjs fraction.js magnitudes (#1779).
 *
 * Native converters wrap values with `new core.Fraction(x)`, which breaks when the
 * unit magnitude is already a fraction.js instance. Patch only the compat
 * instance Unit class — never `instanceSymbols.Unit` or core.
 */
import { BigNumber as CompatBigNumber } from './bignumber.js';
import { isMathjsFraction, mathjsFractionClass } from './mathjs-fraction-class.js';

type UnitConvertersHost = {
  typeConverters: Record<string, (x: unknown) => unknown>;
  _getNumberConverter?: (type: string) => (x: unknown) => unknown;
};

function fractionMagnitudeToBigNumber(x: {
  isFraction?: boolean;
  numerator?: bigint;
  n?: bigint;
  d?: bigint;
  s?: bigint;
}): CompatBigNumber {
  if (x.n !== undefined && x.d !== undefined) {
    const sign = x.s !== undefined && x.s < 0n ? -1n : 1n;
    const bn = new CompatBigNumber(String(sign * x.n)).div(String(x.d));
    return bn as CompatBigNumber;
  }
  const numerator = x.numerator;
  if (numerator === undefined) {
    throw new TypeError('Invalid Fraction magnitude');
  }
  return new CompatBigNumber(String(numerator)).div(String(x.d ?? 1n)) as CompatBigNumber;
}

/** Patch converters on one compat instance `Unit` constructor. */
export function patchCompatUnitTypeConverters(Unit: UnitConvertersHost): void {
  const nativeBigNumber = Unit.typeConverters.BigNumber;
  const nativeNumber = Unit.typeConverters.number;

  Unit.typeConverters.Fraction = (x: unknown) => {
    if (isMathjsFraction(x)) return x;
    return new mathjsFractionClass(x as ConstructorParameters<typeof mathjsFractionClass>[0]);
  };

  Unit.typeConverters.BigNumber = (x: unknown) => {
    const tagged = x as { isFraction?: boolean };
    if (tagged?.isFraction) {
      return fractionMagnitudeToBigNumber(tagged);
    }
    return nativeBigNumber(x);
  };

  Unit.typeConverters.number = (x: unknown) => {
    const tagged = x as { isFraction?: boolean; valueOf?: () => number };
    if (tagged?.isFraction && typeof tagged.valueOf === 'function') {
      return tagged.valueOf();
    }
    return nativeNumber(x);
  };
}
