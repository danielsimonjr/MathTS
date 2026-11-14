/**
 * Type compatibility bridge for mathjs duck-typing.
 *
 * mathjs factories check types via duck-typing (x.isComplex, x.type === 'Complex').
 * The class modules set the `isComplex`, `isFraction` and `isBigNumber` markers on the
 * prototypes (`types/type-marker.ts`). Each instance has its own `type` field. This bridge
 * also sets `type` on each prototype, for code that reads the prototype.
 *
 * Call registerNativeTypes() once at initialization.
 */
import { Complex } from '../types/complex.js';
import { Fraction } from '../types/fraction.js';
import { BigNumber } from '../types/bignumber.js';

let registered = false;

/**
 * Set the `type` marker on the prototypes of the native Complex, Fraction and BigNumber classes.
 *
 * The function sets each marker only when the prototype does not have it.
 * The markers are not writable, not enumerable and not configurable.
 * Calls after the first call do nothing.
 */
export function registerNativeTypes(): void {
  if (registered) return;
  registered = true;

  // Complex: mathjs checks x.isComplex === true && x.type === 'Complex'
  if (!('type' in Complex.prototype)) {
    Object.defineProperty(Complex.prototype, 'type', {
      value: 'Complex',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  // Fraction: mathjs checks x.isFraction === true
  if (!('type' in Fraction.prototype)) {
    Object.defineProperty(Fraction.prototype, 'type', {
      value: 'Fraction',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  // BigNumber: mathjs checks x.isBigNumber === true
  if (!('type' in BigNumber.prototype)) {
    Object.defineProperty(BigNumber.prototype, 'type', {
      value: 'BigNumber',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }
}
