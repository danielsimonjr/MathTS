import { isBigNumber, isFraction } from '@danielsimonjr/mathts-core';
import {
  factory_mathjsCompat,
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
    return { mathjs: 'BigNumber', value: factory_mathjsCompat.string(original) };
  }
  return nativeReplacer(key, value);
}

function assertReviverTagShape(value: object): void {
  const tag = Reflect.get(value, 'mathjs');
  if (tag === 'BigNumber' && !Object.hasOwn(value, 'value')) {
    throw new Error('[DecimalError] Invalid argument: undefined');
  }
  if (tag === 'Complex' && (!Object.hasOwn(value, 're') || !Object.hasOwn(value, 'im'))) {
    throw new SyntaxError('Invalid Param');
  }
}

/** Revive tagged values using only the supplied classes. */
export function reviveWithClasses(value: unknown, classes: Record<string, unknown>): unknown {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, 'mathjs')) return value;
  assertReviverTagShape(value);
  const tag = Reflect.get(value, 'mathjs');
  if (typeof tag !== 'string' || !Object.hasOwn(classes, tag)) return value;
  const constructor = classes[tag] as { fromJSON?: (input: unknown) => unknown } | undefined;
  return typeof constructor?.fromJSON === 'function' ? constructor.fromJSON(value) : value;
}

/** Restore MathJS numeric values, ranges, indices, and expression nodes. */
export function compatReviver(key: string, value: unknown): unknown {
  return reviveInstanceValue(key, value, instanceSymbols.Unit);
}

/** Restore tagged units with the registry belonging to the receiving instance. */
export function reviveInstanceValue(
  key: string,
  value: unknown,
  Unit: typeof instanceSymbols.Unit,
  classes: Record<string, unknown> = instanceSymbols
): unknown {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'mathjs')) {
    assertReviverTagShape(value);
  }
  if (
    value &&
    typeof value === 'object' &&
    Object.hasOwn(value, 'mathjs') &&
    (Reflect.get(value, 'mathjs') === 'Unit' || Reflect.get(value, 'mathjs') === 'BigNumber')
  ) {
    return reviveWithClasses(value, { ...classes, Unit, BigNumber: instanceSymbols.BigNumber });
  }
  const numeric = nativeReviver(key, value);
  return numeric === value ? reviveWithClasses(value, classes) : numeric;
}
