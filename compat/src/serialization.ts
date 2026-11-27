import { isBigNumber, isFraction } from '@danielsimonjr/mathts-core';
import { isMathjsFraction } from './mathjs-fraction-class.js';
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
  if (isMathjsFraction(original)) {
    return original.toJSON();
  }
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

const INSTANCE_WRAPPED_TAGS = new Set(['Unit', 'BigNumber', 'Fraction', 'Complex']);

/** Restore tagged units and instance-wrapped classes with the receiving instance's classes. */
export function reviveInstanceValue(
  key: string,
  value: unknown,
  Unit: typeof instanceSymbols.Unit,
  classes: Record<string, unknown> = instanceSymbols
): unknown {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'mathjs')) {
    assertReviverTagShape(value);
    const tag = Reflect.get(value, 'mathjs');
    if (typeof tag === 'string' && INSTANCE_WRAPPED_TAGS.has(tag)) {
      return reviveWithClasses(value, {
        ...classes,
        Unit,
        BigNumber: classes.BigNumber ?? instanceSymbols.BigNumber,
        Fraction: classes.Fraction ?? instanceSymbols.Fraction,
        Complex: classes.Complex ?? instanceSymbols.Complex,
      });
    }
  }
  const numeric = nativeReviver(key, value);
  return numeric === value ? reviveWithClasses(value, classes) : numeric;
}

type SerializationHost = Record<string, unknown> & {
  Unit: typeof instanceSymbols.Unit;
  BigNumber?: typeof instanceSymbols.BigNumber;
  Complex?: typeof instanceSymbols.Complex;
  Fraction?: typeof instanceSymbols.Fraction;
  Chain?: { fromJSON?: (input: unknown) => unknown };
  Help?: { fromJSON?: (input: unknown) => unknown };
  Parser?: { fromJSON?: (input: unknown) => unknown };
};

/** Class map for `reviveWithClasses` after the instance surface is fully wired. */
export function buildInstanceReviveClasses(instance: SerializationHost): Record<string, unknown> {
  return {
    ...instanceSymbols,
    Unit: instance.Unit,
    BigNumber: instance.BigNumber ?? instanceSymbols.BigNumber,
    Complex: instance.Complex ?? instanceSymbols.Complex,
    Fraction: instance.Fraction ?? instanceSymbols.Fraction,
    Chain: instance.Chain,
    Help: instance.Help,
    Parser: instance.Parser,
    ResultSet: instanceSymbols.ResultSet,
  };
}

/** Bind `replacer` / `reviver` once Chain, Help, and Parser exist on the instance (#1782). */
export function bindInstanceSerialization(instance: SerializationHost): void {
  instance.replacer = compatReplacer;
  instance.reviver = (key: string, value: unknown) => {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'mathjs')) {
      return reviveInstanceValue(key, value, instance.Unit, buildInstanceReviveClasses(instance));
    }
    return nativeReviver(key, value);
  };
}
