/**
 * mathjs 15.3.0 Fraction `format`, `string`, `print`, and Fraction-config
 * `parse().toString()` parity (#1579, #1586) — compat wrappers only; native
 * {@link @danielsimonjr/mathts-core} Fraction formatting is unchanged.
 */
import { isFraction, isUnit, type Fraction } from '@danielsimonjr/mathts-core';
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

function arrayContainsFraction(value: unknown[]): boolean {
  for (const entry of value) {
    if (isFraction(entry)) {
      return true;
    }
    if (Array.isArray(entry) && arrayContainsFraction(entry)) {
      return true;
    }
  }
  return false;
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
  if (!arrayContainsFraction(array)) {
    return nativeFormat(array, options);
  }
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
  if (isUnit(value)) {
    const unit = value as { format?: (opts?: unknown) => string; value?: unknown };
    if (typeof unit.format === 'function') {
      const rendered = unit.format(options);
      if (isFraction(unit.value)) {
        return promoteUnitMagnitudeRatio(rendered);
      }
      return rendered;
    }
    return nativeFormat(value, options);
  }
  return nativeFormat(value, options);
}

type NativeFormat = (value: unknown, options?: unknown) => string;

/** Wrap the native `format` so Fraction ratios and units match mathjs 15.3.0 (#1579). */
export function createCompatFormat(nativeFormat: NativeFormat): NativeFormat {
  return (value: unknown, options?: unknown) => formatCompatValue(value, options, nativeFormat);
}

type NativeString = (value: unknown) => string;

function stringCompatValue(value: unknown, nativeString: NativeString): string {
  if (isFraction(value)) {
    return mathjsFractionDecimalString(value.numerator, value.denominator);
  }
  if (Array.isArray(value)) {
    if (!arrayContainsFraction(value)) {
      return nativeString(value);
    }
    return `[${value.map((entry) => stringCompatValue(entry, nativeString)).join(', ')}]`;
  }
  return nativeString(value);
}

/** Wrap the native `string` so Fraction decimals match mathjs / fraction.js (#1579). */
export function createCompatString(nativeString: NativeString): NativeString {
  return (value: unknown) => stringCompatValue(value, nativeString);
}

type PrintFn = (template: string, values: unknown, options?: unknown) => string;

/** Wrap `print` so the wrong-first-arg error text matches mathjs (#1579). */
export function createCompatPrint(nativePrint: PrintFn): PrintFn {
  const invoke = (...args: unknown[]): string =>
    (nativePrint as (...a: unknown[]) => string)(...args);
  const wrapped = Object.assign((...args: unknown[]) => {
    try {
      return invoke(...args);
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes('function print') &&
        error.message.includes('expected: string') &&
        !error.message.includes('string or boolean')
      ) {
        throw new TypeError(
          error.message.replace(/\bexpected: string\b/, 'expected: string or boolean')
        );
      }
      throw error;
    }
  }, nativePrint);
  return wrapped as PrintFn;
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

/** `node.toString()` with Fraction-config ConstantNode ratios when `number` is `Fraction`. */
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

/** Proxy a parsed node so `toString()` matches mathjs under Fraction config (#1586). */
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
