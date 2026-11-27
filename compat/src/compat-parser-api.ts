/**
 * Parser objects exposed to expression evaluation must be plain objects so the
 * expression sandbox allows `.evaluate()` (#1776). `instanceof Parser` is restored
 * via `Symbol.hasInstance`.
 */

const COMPAT_PARSER_INSTANCES = new WeakSet<object>();

/** Build a parser API object the expression sandbox may call methods on. */
export function createCompatParserApi<T extends Record<string, unknown>>(api: T): T {
  const parserApi = Object.assign(Object.create(Object.prototype), api) as T;
  COMPAT_PARSER_INSTANCES.add(parserApi);
  return parserApi;
}

/** True when `value` is a compat parser API object created by `createCompatParserApi`. */
export function isCompatParserApi(value: unknown): boolean {
  return typeof value === 'object' && value !== null && COMPAT_PARSER_INSTANCES.has(value);
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
