/**
 * Guards for typed `add` / `multiply`: reject operands that must not be coerced
 * (nullish, strings, plain objects, …). Typed-function conversions (e.g. string→number)
 * run before signature tests, so explicit `string, any` signatures do not fire; these
 * checks run before dispatch instead.
 */

export function formatUnexpectedArgumentType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'symbol') return 'symbol';
  if (typeof value === 'function') return 'function';
  if (typeof value === 'object') return '[object Object]';
  return typeof value;
}

export function unexpectedArgumentType(fn: string, value: unknown, index: number): never {
  throw new TypeError(
    `${fn}: unexpected type ${formatUnexpectedArgumentType(value)} at index ${index}`
  );
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/** Reject binary operands that typed-function would convert or mis-dispatch. */
export function rejectInvalidBinaryScalars(fn: string, args: unknown[]): void {
  const n = Math.min(2, args.length);
  for (let i = 0; i < n; i++) {
    const v = args[i];
    if (v == null) unexpectedArgumentType(fn, v, i);
    if (typeof v === 'string' || typeof v === 'symbol' || typeof v === 'function') {
      unexpectedArgumentType(fn, v, i);
    }
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && isPlainObject(v)) {
      unexpectedArgumentType(fn, v, i);
    }
  }
}

/** Run invalid-scalar checks before typed-function dispatch (incl. conversions). */
export function withBinaryScalarGuards<T extends (...args: never[]) => unknown>(
  name: string,
  typedFn: T
): T {
  return Object.assign((...args: Parameters<T>) => {
    rejectInvalidBinaryScalars(name, args as unknown[]);
    return typedFn(...args);
  }, typedFn) as T;
}
