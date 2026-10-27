import { format } from './string.js';
import { isString } from './is.js';

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
