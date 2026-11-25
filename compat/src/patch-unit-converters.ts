/**
 * mathjs 15.3.0 reads fraction.js `.n`/`.d`/`.s` in Unit converters; MathTS Fraction
 * stores sign in `numerator` / `denominator`. Compat patches the converter only (#1551).
 */

import { BigNumber, Fraction, isFraction } from '@danielsimonjr/mathts-core';

type Numeric = unknown;

export function patchCompatUnitTypeConverters(Unit: {
  typeConverters: Record<string, (x: Numeric) => Numeric>;
}): void {
  const previous = Unit.typeConverters.BigNumber;
  Unit.typeConverters.BigNumber = (x: Numeric): Numeric => {
    if (isFraction(x)) {
      const f = x as Fraction;
      return new BigNumber(String(f.numerator)).div(String(f.denominator));
    }
    return previous(x);
  };
}
