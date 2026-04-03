/**
 * Type compatibility bridge for mathjs duck-typing.
 *
 * mathjs factories check types via duck-typing (x.isComplex, x.type === 'Complex').
 * Native MathTS types use instanceof. This bridge adds duck-typing markers to
 * native type prototypes so mathjs factories can recognize them.
 *
 * Call registerNativeTypes() once at initialization.
 */
import { Complex } from '../types/complex.js';
import { Fraction } from '../types/fraction.js';
import { BigNumber } from '../types/bignumber.js';

let registered = false;

export function registerNativeTypes(): void {
  if (registered) return;
  registered = true;

  // Complex: mathjs checks x.isComplex === true && x.type === 'Complex'
  if (!('isComplex' in Complex.prototype)) {
    Object.defineProperty(Complex.prototype, 'isComplex', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
  if (!('type' in Complex.prototype)) {
    Object.defineProperty(Complex.prototype, 'type', {
      value: 'Complex',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  // Fraction: mathjs checks x.isFraction === true
  if (!('isFraction' in Fraction.prototype)) {
    Object.defineProperty(Fraction.prototype, 'isFraction', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
  if (!('type' in Fraction.prototype)) {
    Object.defineProperty(Fraction.prototype, 'type', {
      value: 'Fraction',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  // BigNumber: mathjs checks x.isBigNumber === true
  if (!('isBigNumber' in BigNumber.prototype)) {
    Object.defineProperty(BigNumber.prototype, 'isBigNumber', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
  if (!('type' in BigNumber.prototype)) {
    Object.defineProperty(BigNumber.prototype, 'type', {
      value: 'BigNumber',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
}
