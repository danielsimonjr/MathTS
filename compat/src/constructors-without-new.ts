/**
 * Constructor parity with mathjs 15.3.0 (#1774): the public constructor symbols
 * must behave like the mathjs 15.3.0 classes when `new` is missing.
 *
 * mathjs 15.3.0 has two conventions:
 * - Guard classes (`Parser`, `Index`, `Range`, `Spa`, `ArgumentsError`,
 *   `DimensionError`, ...) are constructor functions whose body starts with
 *   `if (!(this instanceof X)) throw new SyntaxError('Constructor must be
 *   called with the new operator')`, so a new-less call throws a SyntaxError.
 * - Callable classes (`Complex`, `BigNumber`) call themselves with `new`
 *   (`return new X(a, b)`), so a new-less call builds an instance.
 *
 * The compat wrappers below reproduce both conventions over the native
 * classes without touching the packages that own them.
 *
 * @packageDocumentation
 */

/** A callable constructor symbol: a plain factory function or a class. */
type CompatClass = ((...args: never[]) => unknown) | (abstract new (...args: never[]) => object);

/** The message the mathjs 15.3.0 guard classes throw on a new-less call. */
export const NEW_OPERATOR_MESSAGE = 'Constructor must be called with the new operator';

/**
 * Make a class callable without `new`: `X(...)` builds and returns an
 * instance, exactly like the mathjs callable classes (`Complex`, `BigNumber`).
 * The construct path is unchanged, so `instanceof`, the prototype chain and
 * every static keep working through the proxy.
 */
export function callableWithoutNew<T extends CompatClass>(target: T): T {
  return new Proxy(target, {
    apply(t, _thisArg, args) {
      return Reflect.construct(t, args);
    },
  });
}

/**
 * Make a guard class match the mathjs 15.3.0 new-less behavior: `X(...)`
 * throws the mathjs SyntaxError, `new X(...)` constructs normally.
 */
export function newOperatorGuard<T extends CompatClass>(target: T): T {
  return new Proxy(target, {
    apply() {
      throw new SyntaxError(NEW_OPERATOR_MESSAGE);
    },
  });
}
