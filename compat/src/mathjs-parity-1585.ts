/**
 * mathjs 15.3.0–matching adapters for zeta, symbolicEqual, and range (#1585).
 * Native implementations in `@danielsimonjr/mathts-functions` stay more accurate;
 * compat instances call these instead.
 */

import { isConstantNode, parse, simplify } from '@danielsimonjr/mathts-functions';
interface ParityConfig {
  relTol?: number;
  number?: string;
}

type NumericValue =
  number | ({ constructor: new (v: number) => unknown } & Record<string, unknown>);

type CompatTyped = { (...args: unknown[]): unknown };

interface ZetaDeps {
  typed: CompatTyped;
  config: () => ParityConfig;
  multiply: (...args: NumericValue[]) => NumericValue;
  pow: (...args: NumericValue[]) => NumericValue;
  divide: (...args: NumericValue[]) => NumericValue;
  factorial: (...args: NumericValue[]) => NumericValue;
  equal: (a: unknown, b: unknown) => boolean;
  smallerEq: (a: unknown, b: unknown) => boolean;
  isBounded: (x: unknown) => boolean;
  isNegative: (x: unknown) => boolean;
  gamma: (...args: NumericValue[]) => NumericValue;
  sin: (...args: NumericValue[]) => NumericValue;
  subtract: (...args: NumericValue[]) => NumericValue;
  add: (...args: NumericValue[]) => NumericValue;
  Complex: new (re: number, im?: number) => { re: number; im: number };
  BigNumber: new (value: number | string) => unknown;
  pi: number | unknown;
}

/** Riemann zeta as implemented in mathjs 15.3.0 (`function/special/zeta.js`). */
export function createMathjsZeta(deps: ZetaDeps): CompatTyped {
  const {
    typed,
    config,
    multiply,
    pow,
    divide,
    factorial,
    equal,
    smallerEq,
    isBounded,
    isNegative,
    gamma,
    sin,
    subtract,
    add,
    Complex,
    BigNumber,
    pi,
  } = deps;

  function d(k: NumericValue, n: NumericValue): NumericValue {
    let S = k;
    for (let j = k; smallerEq(j, n); j = add(j, 1) as NumericValue) {
      const factor = divide(
        multiply(factorial(add(n, subtract(j, 1) as NumericValue) as NumericValue), pow(4, j)),
        multiply(
          factorial(subtract(n, j) as NumericValue),
          factorial(multiply(2, j) as NumericValue)
        )
      );
      S = add(S, factor) as NumericValue;
    }
    return multiply(n, S) as NumericValue;
  }

  function f(
    s: NumericValue,
    n: NumericValue,
    createValue: (v: number) => NumericValue
  ): NumericValue {
    const c = divide(
      1,
      multiply(d(createValue(0), n), subtract(1, pow(2, subtract(1, s) as NumericValue)))
    );
    let S = createValue(0);
    for (let k = createValue(1); smallerEq(k, n); k = add(k, 1) as NumericValue) {
      const term = divide(multiply(Math.pow(-1, (k as number) - 1), d(k, n)), pow(k, s));
      S = add(S, term) as NumericValue;
    }
    return multiply(c, S) as NumericValue;
  }

  function zetaCore(
    s: NumericValue,
    createValue: (v: number) => NumericValue,
    determineDigits: (v: NumericValue) => number,
    getRe: (v: NumericValue) => number
  ): NumericValue {
    const n = determineDigits(s);
    if (getRe(s) > -(n - 1) / 2) {
      return f(s, createValue(n), createValue);
    }
    const c = multiply(
      multiply(
        multiply(pow(2, s), pow(createValue(piNumber), subtract(s, 1) as NumericValue)),
        sin(multiply(divide(createValue(Math.PI), 2), s))
      ),
      gamma(subtract(1, s) as NumericValue)
    );
    return multiply(
      c,
      zetaCore(subtract(1, s) as NumericValue, createValue, determineDigits, getRe)
    ) as NumericValue;
  }

  function zetaNumeric(
    s: NumericValue,
    createValue: (v: number) => NumericValue,
    determineDigits: () => number
  ): NumericValue {
    if (equal(s, 0)) return createValue(-0.5);
    if (equal(s, 1)) return createValue(NaN);
    if (!isBounded(s)) return isNegative(s) ? createValue(NaN) : createValue(1);
    return zetaCore(
      s,
      createValue,
      () => determineDigits(),
      (v) => v as number
    );
  }

  function zetaComplex(s: { re: number; im: number }): { re: number; im: number } {
    if (s.re === 0 && s.im === 0) return new Complex(-0.5);
    if (s.re === 1) return new Complex(NaN, NaN);
    if (s.re === Infinity && s.im === 0) return new Complex(1);
    if (s.im === Infinity || s.re === -Infinity) return new Complex(NaN, NaN);
    const createValue = (value: number) => new Complex(value) as unknown as NumericValue;
    return zetaCore(
      s as unknown as NumericValue,
      createValue,
      () => Math.round(1.3 * 15 + 0.9 * Math.abs(s.im)),
      () => s.re
    ) as unknown as { re: number; im: number };
  }

  const piNumber = typeof pi === 'number' ? pi : Math.PI;

  const zetaFn = typed('zeta', {
    number: (s: number) =>
      zetaNumeric(
        s,
        (v) => v,
        () => 20
      ),
    BigNumber: (s: NumericValue) =>
      zetaNumeric(
        s,
        (v) => new BigNumber(v) as NumericValue,
        () => Math.abs(Math.log10((config().relTol as number) ?? 1e-12))
      ),
    Complex: zetaComplex,
  }) as CompatTyped;
  return (...args: unknown[]) => {
    if (args.length > 0 && typeof args[0] === 'bigint') {
      args[0] = Number(args[0]);
    }
    return zetaFn(...args);
  };
}

interface SymbolicEqualDeps {
  typed: CompatTyped;
}

/** mathjs 15.3.0 symbolicEqual (simplify-only; no exact polynomial shortcuts). */
export function createMathjsSymbolicEqual(deps: SymbolicEqualDeps): CompatTyped {
  const { typed } = deps;
  const OperatorNode = (
    parse('a-b') as unknown as {
      constructor: new (op: string, fn: string, args: unknown[]) => unknown;
    }
  ).constructor;

  function symbolicEqual(e1: unknown, e2: unknown, options: Record<string, unknown> = {}): boolean {
    const n1 = typeof e1 === 'string' ? parse(e1) : e1;
    const n2 = typeof e2 === 'string' ? parse(e2) : e2;
    const diff = new OperatorNode('-', 'subtract', [n1, n2]);
    const simplified = simplify(diff, {}, options);
    return Boolean(
      isConstantNode(simplified) && !(simplified as unknown as { value: unknown }).value
    );
  }

  return typed('symbolicEqual', {
    'string, string': (s1: string, s2: string) => symbolicEqual(s1, s2),
    'string, string, Object': (s1: string, s2: string, options: Record<string, unknown>) =>
      symbolicEqual(s1, s2, options),
    'Node, Node': symbolicEqual,
    'Node, Node, Object': symbolicEqual,
  }) as CompatTyped;
}

interface RangeDeps {
  nativeRange: (...args: unknown[]) => unknown;
  config: () => ParityConfig;
}

/**
 * mathjs 15.3.0 BigNumber `range` string parsing ignores `includeEnd`
 * (`_strRange` passes it to `_out`, not `_range`). Mirror that quirk only.
 */
export function createMathjsRange(deps: RangeDeps): (...args: unknown[]) => unknown {
  const { nativeRange, config } = deps;
  const range = function range(this: unknown, ...args: unknown[]): unknown {
    if (config().number === 'BigNumber' && typeof args[0] === 'string') {
      if (args.length === 1) return nativeRange.call(this, args[0]);
      if (args.length === 2 && typeof args[1] === 'boolean') return nativeRange.call(this, args[0]);
    }
    return nativeRange.apply(this, args);
  };
  // Colon / `diag(1:3)` go through the typed `range` signatures on the instance.
  // A bare wrapper dropped them and every range doc example diverged.
  const native = nativeRange as { signatures?: unknown; name?: string };
  if (native.signatures !== undefined) {
    (range as unknown as { signatures: unknown }).signatures = native.signatures;
  }
  return range;
}
