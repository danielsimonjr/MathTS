/**
 * Prototype markers that identify a core value across copies of the package.
 *
 * `instanceof` fails when two copies of `@danielsimonjr/mathts-core` load (a failed dedupe, or a
 * test runner that inlines one path and externalizes another): each copy has its own classes. So
 * `Complex`, `Fraction`, `BigNumber` and `Dual` carry a brand on their prototype:
 *
 * - The brand is a `Symbol.for` symbol that only core sets. The type tests of core (`isComplex` and
 *   the others in `types/`) read it. The symbol comes from the global registry, so every copy of
 *   core sees the same symbol, and the object of another library does not carry it.
 * - `Complex`, `Fraction` and `BigNumber` also carry the mathjs marker (`isComplex`, `isFraction`,
 *   `isBigNumber`). Code written for the mathjs duck-typing convention reads it, for example
 *   `core/src/is.ts`. A mathjs object carries the same marker with a different layout (a mathjs
 *   `Fraction` has `s`, `n` and `d`), so the marker does not prove that a value has the core
 *   layout. The type tests of core do not read it.
 *
 * Both are read-only and not enumerable. They add no own key to an instance. This module has no
 * imports, so the class modules can share it without a cycle.
 *
 * Each type test reads its own brand constant at its own site, and does not call a shared helper
 * that takes the brand as an argument. A lookup site that sees four different symbols is
 * megamorphic: a miss, which is the normal result for a matrix or a unit, was three to six times
 * slower than the `instanceof` test it replaces.
 */

/** Brand of `Complex`. */
export const COMPLEX_BRAND: unique symbol = Symbol.for('mathts.core.Complex');
/** Brand of `Fraction`. */
export const FRACTION_BRAND: unique symbol = Symbol.for('mathts.core.Fraction');
/** Brand of `BigNumber`. */
export const BIGNUMBER_BRAND: unique symbol = Symbol.for('mathts.core.BigNumber');
/** Brand of `Dual`. */
export const DUAL_BRAND: unique symbol = Symbol.for('mathts.core.Dual');

/**
 * Set the brand, and the mathjs marker when there is one, on a class prototype.
 *
 * Each property is read-only, not enumerable and not configurable.
 */
export function defineTypeMarkers(
  proto: object,
  brand: symbol,
  mathjsMarker?: 'isComplex' | 'isFraction' | 'isBigNumber'
): void {
  Object.defineProperty(proto, brand, { value: true });
  if (mathjsMarker !== undefined) Object.defineProperty(proto, mathjsMarker, { value: true });
}

/**
 * Brand of the abstract `Matrix` of the matrix package. The matrix package sets it on
 * `Matrix.prototype` (`matrix/src/types/type-marker.ts` re-exports it as `MATRIX_BRAND`), and the
 * result guard of the expression package reads it (`expression/src/utils/safe-result.ts`). The
 * expression package does not depend on the matrix package, so the one definition lives here.
 */
export const NATIVE_MATRIX_BRAND: unique symbol = Symbol.for('mathts.matrix.Matrix');
