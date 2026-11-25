/**
 * mathjs 15.3.0 Fraction `format`, `string`, `print`, and Fraction-config
 * `parse().toString()` parity (#1579, #1586) — compat wrappers only; native
 * {@link @danielsimonjr/mathts-core} Fraction formatting is unchanged.
 */
import { isFraction, isUnit, type Fraction } from '@danielsimonjr/mathts-core';
import { isMatrix } from '@danielsimonjr/mathts-core/internal';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import type { StringOptions } from '@danielsimonjr/mathts-expression';
import Frac from 'fraction.js';

function formatFractionRatio(value: Fraction): string {
  return `${value.numerator}/${value.denominator}`;
}

/** mathjs shows integral unit magnitudes as `n/1` (e.g. `5/1 cm`). */
function promoteUnitMagnitudeRatio(rendered: string): string {
  const match = /^(-?\d+)(\s+.+)$/.exec(rendered);
  if (!match) {
    return rendered;
  }
  return `${match[1]}/1${match[2]}`;
}

function fractionOptionsUseDecimal(options: unknown): boolean {
  return (
    typeof options === 'object' &&
    options !== null &&
    (options as { fraction?: string }).fraction === 'decimal'
  );
}

/** Decimal string via fraction.js — the same helper mathjs 15.3.0 uses internally. */
export function mathjsFractionDecimalString(numerator: bigint, denominator: bigint): string {
  return new Frac(numerator, denominator).toString();
}

function formatCompatArray(
  array: unknown[],
  options: unknown,
  nativeFormat: (value: unknown, options?: unknown) => string
): string {
  const parts: string[] = [];
  for (let i = 0; i < array.length; i++) {
    if (i !== 0) {
      parts.push(', ');
    }
    parts.push(formatCompatValue(array[i], options, nativeFormat));
  }
  return `[${parts.join('')}]`;
}

function formatCompatValue(
  value: unknown,
  options: unknown,
  nativeFormat: (value: unknown, options?: unknown) => string
): string {
  if (isFraction(value) && !fractionOptionsUseDecimal(options)) {
    return formatFractionRatio(value);
  }
  if (Array.isArray(value)) {
    return formatCompatArray(value, options, nativeFormat);
  }
  if (isMatrix(value)) {
    return formatCompatValue(
      (value as { toArray: () => unknown[] }).toArray(),
      options,
      nativeFormat
    );
  }
  if (isUnit(value)) {
    const unit = value as { format?: (opts?: unknown) => string };
    if (typeof unit.format === 'function') {
      const rendered = unit.format(options);
      return promoteUnitMagnitudeRatio(rendered);
    }
    return nativeFormat(value, options);
  }
  return nativeFormat(value, options);
}

type NativeFormat = (value: unknown, options?: unknown) => string;

export function createCompatFormat(nativeFormat: NativeFormat): NativeFormat {
  return (value: unknown, options?: unknown) => formatCompatValue(value, options, nativeFormat);
}

type NativeString = (value: unknown) => string;

function stringCompatValue(value: unknown, nativeString: NativeString): string {
  if (isFraction(value)) {
    return mathjsFractionDecimalString(value.numerator, value.denominator);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stringCompatValue(entry, nativeString)).join(', ')}]`;
  }
  if (isMatrix(value)) {
    return stringCompatValue((value as { toArray: () => unknown[] }).toArray(), nativeString);
  }
  return nativeString(value);
}

export function createCompatString(nativeString: NativeString): NativeString {
  return (value: unknown) => stringCompatValue(value, nativeString);
}

type PrintFn = (template: string, values: unknown, options?: unknown) => string;

export function createCompatPrint(nativePrint: PrintFn): PrintFn {
  const typed = factory_mathjsCompat.createCompatTyped();
  const printImpl: PrintFn = (template, values, options) => nativePrint(template, values, options);
  const bound = typed('print', {
    string: () => {
      throw new TypeError(
        'Too few arguments in function print (expected: Array or Object or Matrix, index: 1)'
      );
    },
    'string, Object | Array': printImpl,
    'string, Object | Array, number | Object': printImpl,
    boolean: () => {
      throw new TypeError(
        'Too few arguments in function print (expected: Array or Object or Matrix, index: 1)'
      );
    },
    'boolean, Object | Array': printImpl,
    'boolean, Object | Array, number | Object': printImpl,
  }) as PrintFn;
  return ((...args: unknown[]) => {
    try {
      return (bound as (...a: unknown[]) => string)(...args);
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes('function print (expected: boolean or string')
      ) {
        throw new TypeError(error.message.replace('boolean or string', 'string or boolean'));
      }
      throw error;
    }
  }) as PrintFn;
}

/** {@link StringOptions} for Fraction-config ConstantNode ratio output (#1586). */
export function fractionCompatConstantStringOptions(options?: StringOptions): StringOptions {
  const prior = typeof options?.handler === 'function' ? options.handler : undefined;
  return {
    ...options,
    handler: (node, opts) => {
      const chained = prior?.(node, opts);
      if (chained !== undefined) {
        return chained;
      }
      const constant = node as { isConstantNode?: boolean; value?: unknown };
      if (constant.isConstantNode && isFraction(constant.value)) {
        return formatFractionRatio(constant.value);
      }
      return undefined;
    },
  };
}

export function compatParseExpressionToString(
  node: { toString(options?: StringOptions): string },
  numberMode: string | undefined
): string {
  if (numberMode !== 'Fraction') {
    return node.toString();
  }
  return node.toString(fractionCompatConstantStringOptions());
}

type ParseableNode = { toString(options?: StringOptions): string };

export function wrapParseNodeForCompatToString<T extends ParseableNode>(
  node: T,
  numberMode: string | undefined
): T {
  if (numberMode !== 'Fraction') {
    return node;
  }
  const native = node.toString.bind(node);
  return new Proxy(node, {
    get(target, prop, receiver) {
      if (prop === 'toString') {
        return (options?: StringOptions) => native(fractionCompatConstantStringOptions(options));
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as T;
}
