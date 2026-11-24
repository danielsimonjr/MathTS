import { isBigNumber, isFraction } from '@danielsimonjr/mathts-core';
import {
  replacer as nativeReplacer,
  reviver as nativeReviver,
} from '@danielsimonjr/mathts-functions';
import { instanceSymbols } from './instance-symbols.js';

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

/** Revive tagged values using only the supplied classes. */
export function reviveWithClasses(value: unknown, classes: Record<string, unknown>): unknown {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, 'mathjs')) return value;
  const tag = Reflect.get(value, 'mathjs');
  if (typeof tag !== 'string' || !Object.hasOwn(classes, tag)) return value;
  const constructor = classes[tag] as { fromJSON?: (input: unknown) => unknown } | undefined;
  return typeof constructor?.fromJSON === 'function' ? constructor.fromJSON(value) : value;
}

/** Restore MathJS numeric values, ranges, indices, and expression nodes. */
export function compatReviver(key: string, value: unknown): unknown {
  const numeric = nativeReviver(key, value);
  return numeric === value ? reviveWithClasses(value, instanceSymbols) : numeric;
}
