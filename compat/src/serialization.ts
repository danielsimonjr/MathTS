import { isBigNumber, isFraction } from '@danielsimonjr/mathts-core';
import { replacer as nativeReplacer } from '@danielsimonjr/mathts-functions';

/** Serialize MathTS numeric values in MathJS's JSON representation. */
export function compatReplacer(this: unknown, key: string, value: unknown): unknown {
  const original =
    this !== null && typeof this === 'object'
      ? Object.getOwnPropertyDescriptor(this, key)?.value
      : undefined;
  if (isFraction(original)) {
    return {
      mathjs: 'Fraction',
      n: String(original.numerator),
      d: String(original.denominator),
    };
  }
  if (isBigNumber(original)) {
    const scientific = original.toExponential();
    const exponent = Number(scientific.split('e')[1]);
    const value = exponent > -7 && exponent < 21 ? original.toFixed() : scientific;
    return { mathjs: 'BigNumber', value };
  }
  return nativeReplacer(key, value);
}
