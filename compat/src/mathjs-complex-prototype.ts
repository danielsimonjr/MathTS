/**
 * mathjs 15.3.0 `Complex` prototype parity (#1781): `valueOf` mirrors `toString`,
 * and `format` matches the complex.js wrapper in mathjs `Complex.js` (ratio-based
 * epsilon rounding and numeric precision shorthand).
 */
import { Complex, isBigNumber, isNumber } from '@danielsimonjr/mathts-core';
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

function mathjsComplexFormat(this: Complex, options?: ComplexFormatOptions): string {
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

let installed = false;

/** Install mathjs 15.3.0 `format` / `valueOf` on the core `Complex` prototype (idempotent). */
export function installMathjsComplexPrototype(): void {
  if (installed) {
    return;
  }
  installed = true;
  Object.defineProperty(Complex.prototype, 'format', {
    value: mathjsComplexFormat,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(Complex.prototype, 'valueOf', {
    value: function (this: Complex): string {
      return this.toString();
    },
    writable: true,
    configurable: true,
  });
}
