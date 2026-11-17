import { format } from './string.js';
import { isBigNumber, isString } from './is.js';
import { assertLoopOrder } from './limits.js';

/**
 * Throw a RangeError when the precision in `options` (a number, a BigNumber or the
 * `precision` option) exceeds MAX_LOOP_ORDER (10000000), because the formatter pads
 * the result to that many digits.
 */
export function assertFormatPrecision(options: unknown): void {
  const raw =
    typeof options === 'object' && options !== null && !isBigNumber(options)
      ? (options as { precision?: unknown }).precision
      : options;
  if (typeof raw === 'number' || isBigNumber(raw)) {
    assertLoopOrder('format', 'precision', Number(raw));
  }
}

export const printTemplate = /\$([\w.]+)/g;

/**
 * Interpolate values into a string template (`$key` / `$key.nested`).
 * @private
 */
export function fillPrintTemplate(
  template: string,
  values: Record<string, unknown> | unknown[],
  options?: number | Record<string, unknown>
): string {
  if (options !== undefined) assertFormatPrecision(options);
  return template.replace(printTemplate, function (original: string, key: string): string {
    const keys = key.split('.');
    let value: unknown = (values as Record<string, unknown>)[keys.shift()!];
    if (value !== undefined && (value as { isMatrix?: boolean }).isMatrix) {
      value = (value as { toArray: () => unknown[] }).toArray();
    }
    while (keys.length && value !== undefined) {
      const k = keys.shift();
      value = k ? (value as Record<string, unknown>)[k] : (value as string) + '.';
    }

    if (value !== undefined) {
      if (!isString(value)) {
        return format(value, options);
      }
      return value as string;
    }

    return original;
  });
}
