import { Fraction, isFraction } from '@danielsimonjr/mathts-core';
import {
  installMathjsFractionClass,
  isMathjsFraction,
  type MathjsFraction,
} from './mathjs-fraction-class.js';

installMathjsFractionClass();

/** Core `Fraction` instances from mixed pipelines still get mathjs string `n`/`d` on demand. */
function coreFractionToJson(this: Fraction): { mathjs: 'Fraction'; n: string; d: string } {
  return {
    mathjs: 'Fraction',
    n: String(this.numerator),
    d: String(this.denominator),
  };
}

/** mathjs 15.3.0 always emits string `n` / `d` on Fraction JSON (#1575 G20 D7). */
export function ensureMathjsFractionToJson<T>(value: T): T {
  if (isMathjsFraction(value)) return value;
  if (!isFraction(value)) return value;
  if (Object.getOwnPropertyDescriptor(value, 'toJSON')?.value === coreFractionToJson) {
    return value;
  }
  Object.defineProperty(value, 'toJSON', {
    configurable: true,
    enumerable: false,
    value: coreFractionToJson,
  });
  return value;
}

/** Ensure core `Fraction` instances JSON the mathjs way when they are not typed wrappers. */
export function installMathjsFractionJson(): void {
  const proto = Fraction.prototype as Fraction & {
    toJSON?: () => { mathjs: 'Fraction'; n: string; d: string };
  };
  if (Object.getOwnPropertyDescriptor(proto, 'toJSON')?.value === coreFractionToJson) {
    return;
  }
  Object.defineProperty(proto, 'toJSON', {
    configurable: true,
    enumerable: false,
    value: coreFractionToJson,
  });
}

installMathjsFractionJson();

export const withMathjsFractionJson = ensureMathjsFractionToJson;

export type { MathjsFraction };
