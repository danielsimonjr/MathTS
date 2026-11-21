/**
 * Prototype brands that identify a matrix of this package across copies of the package.
 *
 * `instanceof` fails when two copies of `@danielsimonjr/mathts-matrix` load (a failed dedupe, or a
 * test runner that inlines one path and externalizes another). Each copy has its own classes. So
 * `Matrix`, `DenseMatrix` and `SparseMatrix` carry a brand on their prototype (#1041), with the same pattern
 * as the core scalar classes (`core/src/types/type-marker.ts`):
 *
 * - The brand is a `Symbol.for` symbol that only this package sets. `isNativeMatrix`,
 *   `isDenseMatrix` and `isSparseMatrix` read it. The symbol comes from the global registry, so
 *   every copy of the package sees the same symbol. The object of another library does not carry it.
 * - A subclass inherits the brand, as it passes `instanceof`.
 * - The brand is read-only and not enumerable. It adds no own key to an instance.
 *
 * Each type test reads its own brand constant at its own site, so each lookup site sees one symbol.
 * This module imports only core, so the class modules can share it without a cycle.
 */

/**
 * Brand of the abstract `Matrix` base. `DenseMatrix` and `SparseMatrix` inherit it. Its one
 * definition is in core (`NATIVE_MATRIX_BRAND`), because the result guard of the expression
 * package reads it too.
 */
export { NATIVE_MATRIX_BRAND as MATRIX_BRAND } from '@danielsimonjr/mathts-core/internal';
/** Brand of `DenseMatrix`. */
export const DENSE_MATRIX_BRAND: unique symbol = Symbol.for('mathts.matrix.DenseMatrix');
/** Brand of `SparseMatrix`. */
export const SPARSE_MATRIX_BRAND: unique symbol = Symbol.for('mathts.matrix.SparseMatrix');

/**
 * Set a brand on a class prototype. The property is read-only, not enumerable and not configurable.
 *
 * @param proto - The class prototype.
 * @param brand - The brand symbol.
 */
export function defineMatrixBrand(proto: object, brand: symbol): void {
  Object.defineProperty(proto, brand, { value: true });
}
