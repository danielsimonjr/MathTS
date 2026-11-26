import { Fraction, isFraction } from '@danielsimonjr/mathts-core';

function mathjsFractionToJson(this: Fraction): { mathjs: 'Fraction'; n: string; d: string } {
  return {
    mathjs: 'Fraction',
    n: String(this.numerator),
    d: String(this.denominator),
  };
}

/** mathjs 15.3.0 always emits string `n` / `d` on Fraction JSON (#1575 G20 D7). */
export function ensureMathjsFractionToJson<T>(value: T): T {
  if (!isFraction(value)) return value;
  if (Object.getOwnPropertyDescriptor(value, 'toJSON')?.value === mathjsFractionToJson) {
    return value;
  }
  Object.defineProperty(value, 'toJSON', {
    configurable: true,
    enumerable: false,
    value: mathjsFractionToJson,
  });
  return value;
}

/** Ensure core `Fraction` instances JSON the mathjs way when they are not typed wrappers. */
export function installMathjsFractionJson(): void {
  const proto = Fraction.prototype as Fraction & {
    toJSON?: () => { mathjs: 'Fraction'; n: string; d: string };
  };
  if (Object.getOwnPropertyDescriptor(proto, 'toJSON')?.value) {
    return;
  }
  Object.defineProperty(proto, 'toJSON', {
    configurable: true,
    enumerable: false,
    value: mathjsFractionToJson,
  });
}

installMathjsFractionJson();

export const withMathjsFractionJson = ensureMathjsFractionToJson;
