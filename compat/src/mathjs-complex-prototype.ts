/**
 * mathjs 15.3.0 `Complex` prototype parity (#1781): `valueOf` mirrors `toString`,
 * and `format` matches the complex.js wrapper in mathjs `Complex.js` (ratio-based
 * epsilon rounding and numeric precision shorthand).
 *
 * Isolated to a `CompatComplex` subclass so native `@danielsimonjr/mathts-core`
 * `Complex.prototype` is never mutated.
 */
import { Complex as CoreComplex, isBigNumber, isNumber } from '@danielsimonjr/mathts-core';
import { format as formatNumber } from '@danielsimonjr/mathts-functions';

type ComplexFormatOptions =
  number | { precision?: number | { toNumber(): number } } | null | undefined;

function precisionFromFormatOptions(options: ComplexFormatOptions): number | null {
  if (options === undefined || options === null) {
    return null;
  }
  if (isNumber(options)) {
    return options;
  }
  if (isBigNumber(options)) {
    return options.toNumber();
  }
  if (typeof options === 'object' && options.precision !== undefined) {
    const precision = options.precision;
    if (isNumber(precision)) {
      return precision;
    }
    if (isBigNumber(precision)) {
      return precision.toNumber();
    }
    throw new Error('Option "precision" must be a number or BigNumber');
  }
  return null;
}

function mathjsComplexFormat(this: CoreComplex, options?: ComplexFormatOptions): string {
  let im = this.im;
  let re = this.re;
  const strRe = formatNumber(this.re, options);
  const strIm = formatNumber(this.im, options);

  const precision = precisionFromFormatOptions(options);
  if (precision !== null) {
    const epsilon = Math.pow(10, -precision);
    if (Math.abs(re / im) < epsilon) {
      re = 0;
    }
    if (Math.abs(im / re) < epsilon) {
      im = 0;
    }
  }

  if (im === 0) {
    return strRe;
  }
  if (re === 0) {
    if (im === 1) {
      return 'i';
    }
    if (im === -1) {
      return '-i';
    }
    return `${strIm}i`;
  }
  if (im < 0) {
    if (im === -1) {
      return `${strRe} - i`;
    }
    return `${strRe} - ${strIm.slice(1)}i`;
  }
  if (im === 1) {
    return `${strRe} + i`;
  }
  return `${strRe} + ${strIm}i`;
}

/**
 * Compat-isolated `Complex` subclass carrying mathjs 15.3.0 `format` and `valueOf`
 * without mutating `@danielsimonjr/mathts-core`'s `Complex.prototype`.
 */
export class CompatComplexBase extends CoreComplex {
  static [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof CoreComplex;
  }
}

Object.defineProperty(CompatComplexBase.prototype, 'format', {
  value: mathjsComplexFormat,
  writable: true,
  configurable: true,
});

Object.defineProperty(CompatComplexBase.prototype, 'valueOf', {
  value: function (this: CoreComplex): string {
    return this.toString();
  },
  writable: true,
  configurable: true,
});

/** Upgrade a native `CoreComplex` (or array / Matrix of them) to `CompatComplexBase`. */
export function toCompatComplex<T>(value: T): T {
  if (value instanceof CoreComplex) {
    if (Object.getPrototypeOf(value) === CompatComplexBase.prototype) {
      return value;
    }
    return new CompatComplexBase(value.re, value.im) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toCompatComplex(item)) as unknown as T;
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    'isMatrix' in value &&
    (value as { isMatrix?: boolean }).isMatrix === true &&
    'map' in value &&
    typeof (value as { map?: unknown }).map === 'function'
  ) {
    return (value as unknown as { map: (fn: (item: unknown) => unknown) => unknown }).map((item) =>
      toCompatComplex(item)
    ) as T;
  }
  return value;
}

// Keep compat display/valueOf semantics on Complex results returned by prototype methods.
for (const name of Object.getOwnPropertyNames(CoreComplex.prototype)) {
  if (Object.hasOwn(CompatComplexBase.prototype, name)) continue;
  const descriptor = Object.getOwnPropertyDescriptor(CoreComplex.prototype, name);
  const method = descriptor?.value;
  if (typeof method !== 'function') continue;
  Object.defineProperty(CompatComplexBase.prototype, name, {
    ...descriptor,
    value(this: CompatComplexBase, ...args: unknown[]) {
      return toCompatComplex(Reflect.apply(method, this, args));
    },
  });
}
