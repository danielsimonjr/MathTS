/**
 * mathjs 15.3.0 Fraction `format`, `string`, `print`, and Fraction-config
 * `parse().toString()` parity (#1579, #1586) — compat wrappers only; native
 * {@link @danielsimonjr/mathts-core} Fraction formatting is unchanged.
 */
import {
  isFraction,
  isMatrix,
  isSparseMatrix,
  isUnit,
  type Fraction,
} from '@danielsimonjr/mathts-core';
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

function matrixContainsFraction(value: {
  toArray?: () => unknown;
  forEach?: (callback: (entry: unknown) => void) => void;
}): boolean {
  if (typeof value.forEach === 'function' && isSparseMatrix(value)) {
    let found = false;
    value.forEach((entry) => {
      if (isFraction(entry)) {
        found = true;
      }
    });
    return found;
  }
  const data = typeof value.toArray === 'function' ? value.toArray() : undefined;
  return Array.isArray(data) && arrayContainsFraction(data);
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

type NativeFormat = (value: unknown, options?: unknown) => string;

function formatCompatArray(array: unknown[], options: unknown, nativeFormat: NativeFormat): string {
  const parts: string[] = [];
  for (let i = 0; i < array.length; i++) {
    if (i !== 0) {
      parts.push(', ');
    }
    parts.push(formatCompatValue(array[i], options, nativeFormat));
  }
  return `[${parts.join('')}]`;
}

function formatSparseCompat(
  value: {
    size(): number[];
    density(): number;
    forEach(callback: (entry: unknown, index: number[]) => void): void;
  },
  options: unknown,
  nativeFormat: NativeFormat
): string {
  const [rows, columns] = value.size();
  let result =
    'Sparse Matrix [' +
    formatCompatValue(rows, options, nativeFormat) +
    ' x ' +
    formatCompatValue(columns, options, nativeFormat) +
    '] density: ' +
    formatCompatValue(value.density(), options, nativeFormat) +
    '\n';
  value.forEach((entry, index) => {
    // mathjs CSC format lists stored entries only (implicit numeric zeros omitted).
    if (entry === 0 || entry === 0n) {
      return;
    }
    result +=
      '\n    (' +
      formatCompatValue(index[0], options, nativeFormat) +
      ', ' +
      formatCompatValue(index[1], options, nativeFormat) +
      ') ==> ' +
      formatCompatValue(entry, options, nativeFormat);
  });
  return result;
}

function formatCompatValue(value: unknown, options: unknown, nativeFormat: NativeFormat): string {
  if (isFraction(value) && !fractionOptionsUseDecimal(options)) {
    return formatFractionRatio(value);
  }
  if (Array.isArray(value)) {
    if (!arrayContainsFraction(value)) {
      return nativeFormat(value, options);
    }
    return formatCompatArray(value, options, nativeFormat);
  }
  if (isSparseMatrix(value)) {
    if (
      !matrixContainsFraction(
        value as {
          toArray?: () => unknown;
          forEach?: (callback: (entry: unknown) => void) => void;
        }
      )
    ) {
      return nativeFormat(value, options);
    }
    return formatSparseCompat(
      value as {
        size(): number[];
        density(): number;
        forEach(callback: (entry: unknown, index: number[]) => void): void;
      },
      options,
      nativeFormat
    );
  }
  if (isMatrix(value)) {
    if (
      !matrixContainsFraction(
        value as {
          toArray?: () => unknown;
          forEach?: (callback: (entry: unknown) => void) => void;
        }
      )
    ) {
      return nativeFormat(value, options);
    }
    return formatCompatValue((value as { toArray(): unknown }).toArray(), options, nativeFormat);
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

/** Wrap the native `format` so Fraction ratios and units match mathjs 15.3.0 (#1579). */
export function createCompatFormat(nativeFormat: NativeFormat): NativeFormat {
  return (value: unknown, options?: unknown) => {
    const normalized = typeof options === 'number' ? { precision: options } : options;
    return formatCompatValue(value, normalized, nativeFormat);
  };
}

type NativeString = (value: unknown) => unknown;

function stringCompatValue(value: unknown, nativeString: NativeString): unknown {
  if (isFraction(value)) {
    return mathjsFractionDecimalString(value.numerator, value.denominator);
  }
  if (Array.isArray(value)) {
    if (!arrayContainsFraction(value)) {
      return nativeString(value);
    }
    return value.map((entry) => stringCompatValue(entry, nativeString));
  }
  if (isMatrix(value)) {
    if (
      !matrixContainsFraction(
        value as {
          toArray?: () => unknown;
          forEach?: (callback: (entry: unknown) => void) => void;
        }
      )
    ) {
      return nativeString(value);
    }
    return (value as { map: (fn: (entry: unknown) => unknown) => unknown }).map((entry) =>
      stringCompatValue(entry, nativeString)
    );
  }
  return nativeString(value);
}

/** Wrap the native `string` so Fraction decimals match mathjs / fraction.js (#1579). */
export function createCompatString(nativeString: NativeString): NativeString {
  return (value: unknown) => stringCompatValue(value, nativeString);
}

type PrintFn = (template: string, values: unknown, options?: unknown) => string;

const PRINT_TEMPLATE = /\$([\w.]+)/g;

function interpolatePrint(
  template: string,
  values: Record<string, unknown> | unknown[],
  options: unknown,
  format: NativeFormat
): string {
  return template.replace(PRINT_TEMPLATE, (original: string, key: string): string => {
    const keys = key.split('.');
    let value: unknown = (values as Record<string, unknown>)[keys.shift()!];
    if (value !== undefined && isMatrix(value)) {
      value = (value as { toArray: () => unknown }).toArray();
    }
    while (keys.length && value !== undefined) {
      const k = keys.shift();
      value = k ? (value as Record<string, unknown>)[k] : (value as string) + '.';
    }
    if (value !== undefined) {
      if (typeof value === 'string') {
        return value;
      }
      return format(value, options);
    }
    return original;
  });
}

/** Wrap `print` so Fraction placeholders and the wrong-first-arg error match mathjs (#1579). */
export function createCompatPrint(nativePrint: PrintFn, nativeFormat: NativeFormat): PrintFn {
  const format = createCompatFormat(nativeFormat);
  const invoke = (...args: unknown[]): string =>
    (nativePrint as (...a: unknown[]) => string)(...args);
  const wrapped = Object.assign((...args: unknown[]) => {
    try {
      const template = args[0];
      const values = args[1];
      const options = args[2];
      if (typeof template === 'string' && values != null && typeof values === 'object') {
        return interpolatePrint(
          template,
          values as Record<string, unknown> | unknown[],
          options,
          format
        );
      }
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
