/**
 * Typed Unit Functions
 *
 * Polymorphic dimensional-analysis operations dispatched through
 * `mathTyped`. Wraps the {@link Unit} value type from
 * `@danielsimonjr/mathts-core`:
 *
 *  - `to(value, target)` — convert a Unit (or construct one) to a target
 *    notation. Throws on dimension mismatch.
 *  - `toBest(value)` — pick the unit (with SI prefix) that gives the
 *    magnitude closest to 1.
 *
 * Both functions accept either a `Unit` instance or a `(value, notation)`
 * pair (the latter just constructs a `Unit` on the fly).
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
// The single, merged Unit. `Unit` (the value) constructs it; `UnitInstance` is the
// instance type used in signatures.
import { Unit, type UnitInstance } from '@danielsimonjr/mathts-core';

// =============================================================================
// to(value, target)
// =============================================================================

/**
 * Convert a quantity to a target unit notation.
 *
 * Dispatches over:
 *
 *  - `(Unit, string)` — convert an existing Unit to the target.
 *  - `(number, string)` — construct a Unit from a bare numeric value with
 *    the given notation. (No conversion happens — the result simply *labels*
 *    the value with the target notation. Useful for entering a quantity
 *    into the unit system.)
 *
 * @example
 * ```ts
 * to(new Unit(1, 'm'), 'ft');       // 1 m → 3.28084 ft
 * to(20, '°C');                     // construct: 20 °C
 * ```
 *
 * @throws {DimensionMismatchError} when converting between incompatible
 *   dimension vectors (e.g. metres to seconds).
 */
export const to = mathTyped('to', {
  'Unit, string': (value: UnitInstance, target: string): UnitInstance => value.to(target),
  'number, string': (value: number, target: string): UnitInstance => new Unit(value, target),
});

// =============================================================================
// toBest(value)
// =============================================================================

/**
 * Pick a unit-of-magnitude representation that places the displayed value
 * closest to 1.
 *
 * For example, `0.0001 m` becomes `0.1 mm`, and `1500 g` (canonical
 * `1.5 kg`) becomes `1.5 kg`.
 *
 * @example
 * ```ts
 * toBest(new Unit(0.0001, 'm'));    // 0.1 mm
 * toBest(new Unit(1000, 'g'));      // 1 kg
 * ```
 */
export const toBest = mathTyped('toBest', {
  Unit: (value: UnitInstance): UnitInstance => value.toBest(),
});

// =============================================================================
// Barrel
// =============================================================================

/**
 * All typed unit functions combined.
 */
export const typedUnit = {
  to,
  toBest,
};
