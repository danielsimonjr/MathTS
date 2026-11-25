/**
 * mathjs 15.3.0 reads fraction.js `.n`/`.d`/`.s` in Unit converters; MathTS Fraction
 * stores sign in `numerator` / `denominator`. Compat patches the converter only (#1551).
 */

import { BigNumber, Fraction, isFraction } from '@danielsimonjr/mathts-core';

type Numeric = unknown;

function convertFractionToBigNumber(x: Numeric, previous: (x: Numeric) => Numeric): Numeric {
  if (isFraction(x)) {
    const f = x as Fraction;
    return new BigNumber(String(f.numerator)).div(String(f.denominator));
  }
  return previous(x);
}

export function patchCompatUnitTypeConverters(Unit: {
  typeConverters: Record<string, unknown>;
  _getNumberConverter?: (type: string) => (x: never) => Numeric;
}): void {
  const previousConverters = Unit.typeConverters;
  const previous = previousConverters.BigNumber as (x: Numeric) => Numeric;
  const patched = (x: Numeric): Numeric => convertFractionToBigNumber(x, previous);
  Unit.typeConverters = {
    ...previousConverters,
    BigNumber: patched,
  };
  if (typeof Unit._getNumberConverter === 'function') {
    const origGet = Unit._getNumberConverter.bind(Unit);
    Unit._getNumberConverter = ((type: string) => {
      const fn = origGet(type) as (x: Numeric) => Numeric;
      if (type === 'BigNumber') {
        return (x: Numeric) => convertFractionToBigNumber(x, fn);
      }
      return fn;
    }) as typeof Unit._getNumberConverter;
  }
}
