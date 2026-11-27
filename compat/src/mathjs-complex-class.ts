/**
 * The mathjs 15.3.0 `Complex` constructor surface (#1774).
 *
 * mathjs's `Complex` is the complex.js class: it is callable without `new`,
 * and its constructor takes `(re, im)`, an object `{ re, im }`, an object
 * `{ r, phi }`, an object `{ abs, arg }`, a two-element array or a string in
 * the complex.js text form. Anything else throws `SyntaxError('Invalid
 * Param')`. `Complex.fromPolar` takes either `{ r, phi }` or `(r, phi)` where
 * `phi` may be an angle Unit.
 *
 * This module reproduces that surface over the native `Complex` class of
 * `@danielsimonjr/mathts-core`. The parser below is a faithful port of the
 * complex.js 2.4.2 string parser (the version mathjs 15.3.0 depends on), so
 * the accepted forms and the `Invalid Param` errors match exactly.
 *
 * @packageDocumentation
 */

import type { Complex } from '@danielsimonjr/mathts-core';

/** The unit surface `fromPolar` needs for an angle operand. */
export interface AngleUnitLike {
  hasBase(base: string): boolean;
  toNumber(unit: string): number;
}

/** The constructor surface the compat instance exposes as `Complex`. */
export type MathjsComplexConstructor = typeof Complex & {
  new (value?: unknown, imaginary?: number): Complex;
  (value?: unknown, imaginary?: number): Complex;
  fromPolar(args: { r: number; phi: number | AngleUnitLike }): Complex;
  fromPolar(r?: number, phi?: number | AngleUnitLike): Complex;
};

/** The complex.js parse result before it reaches the native constructor. */
interface ComplexParts {
  re: number;
  im: number;
}

/** Exit the parser the way complex.js does: a SyntaxError, not a TypeError. */
function parserExit(): never {
  throw new SyntaxError('Invalid Param');
}

/** complex.js calls `isNaN(token)`, whose coercion is `isNaN(Number(token))`. */
function tokenIsNaN(token: string): boolean {
  return Number.isNaN(Number(token));
}

/**
 * The complex.js 2.4.2 string parser: sign tokens accumulate, a digit token
 * followed by `i`/`I` feeds the imaginary part, and any leftover sign or
 * unknown token exits with `Invalid Param`.
 */
function parseComplexString(text: string): ComplexParts {
  const parts: ComplexParts = { re: 0, im: 0 };
  const tokens = text.replace(/_/g, '').match(/\d+\.?\d*e[+-]?\d+|\d+\.?\d*|\.\d+|./g);
  let plus = 1;
  let minus = 0;

  if (tokens === null) parserExit();

  for (let i = 0; i < tokens.length; i++) {
    const c = tokens[i];

    if (c === ' ' || c === '\t' || c === '\n') {
      // Whitespace tokens carry no sign and no value.
    } else if (c === '+') {
      plus++;
    } else if (c === '-') {
      minus++;
    } else if (c === 'i' || c === 'I') {
      if (plus + minus === 0) parserExit();

      const next = tokens[i + 1];
      if (next !== ' ' && !isNaN(Number(next))) {
        parts.im += parseFloat((minus % 2 ? '-' : '') + next);
        i++;
      } else {
        parts.im += parseFloat((minus % 2 ? '-' : '') + '1');
      }
      plus = minus = 0;
    } else {
      if (plus + minus === 0 || tokenIsNaN(c)) parserExit();

      const next = tokens[i + 1];
      if (next === 'i' || next === 'I') {
        parts.im += parseFloat((minus % 2 ? '-' : '') + c);
        i++;
      } else {
        parts.re += parseFloat((minus % 2 ? '-' : '') + c);
      }
      plus = minus = 0;
    }
  }

  // Still something on the stack.
  if (plus + minus > 0) parserExit();

  return parts;
}

/**
 * The complex.js 2.4.2 `parse` over every accepted constructor form. The
 * `(re, im)` pair is stored as given (complex.js does not coerce), and a
 * `{ abs, arg }` / `{ r, phi }` object with a non-finite radius and a finite
 * angle becomes the infinity point, as complex.js returns `Complex.INFINITY`.
 */
export function mathjsComplexParse(a?: unknown, b?: unknown): ComplexParts {
  if (a === undefined || a === null) {
    return { re: 0, im: 0 };
  }
  if (b !== undefined) {
    return { re: a as number, im: b as number };
  }

  switch (typeof a) {
    case 'object': {
      const obj = a as { length?: number } & Record<string, unknown>;
      if ('im' in obj && 're' in obj) {
        return { re: obj.re as number, im: obj.im as number };
      }
      if ('abs' in obj && 'arg' in obj) {
        if (!isFinite(obj.abs as number) && isFinite(obj.arg as number)) {
          return { re: Infinity, im: Infinity };
        }
        return {
          re: (obj.abs as number) * Math.cos(obj.arg as number),
          im: (obj.abs as number) * Math.sin(obj.arg as number),
        };
      }
      if ('r' in obj && 'phi' in obj) {
        if (!isFinite(obj.r as number) && isFinite(obj.phi as number)) {
          return { re: Infinity, im: Infinity };
        }
        return {
          re: (obj.r as number) * Math.cos(obj.phi as number),
          im: (obj.r as number) * Math.sin(obj.phi as number),
        };
      }
      if (obj.length === 2) {
        return { re: obj[0] as number, im: obj[1] as number };
      }
      return parserExit();
    }

    case 'string':
      return parseComplexString(a);

    case 'number':
      return { re: a, im: 0 };

    default:
      return parserExit();
  }
}

/** The `isNumber` / `isUnit` predicates `fromPolar` dispatches with. */
export interface MathjsComplexDeps {
  isNumber(value: unknown): boolean;
  isUnit(value: unknown): boolean;
}

/**
 * Wrap the native `Complex` class with the mathjs 15.3.0 constructor surface:
 * new-less calls build an instance, every complex.js input form is accepted,
 * invalid ones throw `SyntaxError('Invalid Param')`, and `fromPolar` follows
 * the mathjs argument rules. The construct path of `new Complex(...)` is
 * unchanged, so `instanceof` and the prototype chain keep working.
 */
export function mathjsComplexProxy(
  target: typeof Complex,
  deps: MathjsComplexDeps
): MathjsComplexConstructor {
  /** A constructor value as the proxy traps receive it. */
  type ProxyNewTarget = abstract new (...args: never[]) => Complex | undefined;

  const constructComplex = (parts: ComplexParts, newTarget?: ProxyNewTarget): Complex => {
    const args = [parts.re, parts.im];
    // `Reflect.construct(target, args, undefined)` rejects the explicit
    // undefined third argument on this runtime, so omit it when unset.
    return newTarget === undefined
      ? (Reflect.construct(target, args) as Complex)
      : (Reflect.construct(target, args, newTarget) as Complex);
  };

  /** Build a Complex from one complex.js parse input (the `Complex(arg)` call). */
  const constructFromArg = (arg: unknown, newTarget?: ProxyNewTarget): Complex =>
    constructComplex(mathjsComplexParse(arg), newTarget);

  /** mathjs `Complex.fromPolar`: `{ r, phi }` for one argument, `(r, phi)` for two. */
  const compatFromPolar = function (this: unknown, ...args: unknown[]): Complex {
    switch (args.length) {
      case 1: {
        const arg = args[0];
        if (typeof arg === 'object') {
          return constructFromArg(arg);
        }
        throw new TypeError('Input has to be an object with r and phi keys.');
      }
      case 2: {
        const r = args[0];
        let phi = args[1];
        if (deps.isNumber(r)) {
          if (deps.isUnit(phi) && (phi as AngleUnitLike).hasBase('ANGLE')) {
            phi = (phi as AngleUnitLike).toNumber('rad');
          }
          if (deps.isNumber(phi)) {
            return constructFromArg({ r, phi });
          }
          throw new TypeError('Phi is not a number nor an angle unit.');
        }
        throw new TypeError('Radius r is not a number.');
      }
      default:
        throw new SyntaxError('Wrong number of arguments in function fromPolar');
    }
  };

  return new Proxy(target, {
    apply(_target, _thisArg, args) {
      return constructComplex(mathjsComplexParse(...(args as [unknown?, unknown?])));
    },
    construct(_target, args, newTarget) {
      return constructComplex(
        mathjsComplexParse(...(args as [unknown?, unknown?])),
        newTarget as ProxyNewTarget
      );
    },
    get(t, prop, receiver) {
      if (prop === 'fromPolar') {
        return compatFromPolar;
      }
      return Reflect.get(t, prop, receiver);
    },
    ownKeys(t) {
      const keys = Reflect.ownKeys(t);
      return keys.includes('fromPolar') ? keys : [...keys, 'fromPolar'];
    },
    getOwnPropertyDescriptor(t, prop) {
      // Consumers copy own properties off the class (function-surface copies),
      // which bypasses the `get` trap; keep `fromPolar` the compat one there too.
      if (prop === 'fromPolar') {
        return {
          value: compatFromPolar,
          writable: true,
          enumerable: true,
          configurable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(t, prop);
    },
  }) as unknown as MathjsComplexConstructor;
}
