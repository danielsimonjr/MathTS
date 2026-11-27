/**
 * Parser objects exposed to expression evaluation must be plain objects so the
 * expression sandbox allows `.evaluate()` (#1776). `instanceof Parser` is restored
 * via `Symbol.hasInstance`.
 */

/** Build a parser API object the expression sandbox may call methods on. */
export function createCompatParserApi<T extends Record<string, unknown>>(api: T): T {
  return Object.assign(Object.create(Object.prototype), api);
}

/** True when `value` looks like a compat parser API object. */
export function isCompatParserApi(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.evaluate === 'function' &&
    typeof record.get === 'function' &&
    typeof record.set === 'function' &&
    record.scope !== undefined
  );
}

/** Patch `instanceof` for parser constructors that return plain API objects. */
export function installParserHasInstance(ctor: object): void {
  Object.defineProperty(ctor, Symbol.hasInstance, {
    configurable: true,
    writable: true,
    value(value: unknown) {
      return isCompatParserApi(value);
    },
  });
}
