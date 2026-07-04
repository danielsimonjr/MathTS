/**
 * The core `Unit` — now the single, feature-complete implementation under
 * `./unit/` (the mathjs-derived Unit relocated into core by the Unit merge).
 *
 * This module previously held a separate, simpler `Unit` class (canonical-value
 * subset). That has been RETIRED: the two Unit implementations are one now. This
 * file preserves the historical public surface — `Unit`, the typed error classes,
 * `isUnit`, and the dimension helpers — by re-exporting them, so
 * `@danielsimonjr/mathts-core` consumers see no import churn.
 *
 * Behavioral notes for callers of the former core `Unit`:
 * - Arithmetic (`add`/`sub`/`mul`/`div`) is done at the OPERATOR level (via the
 *   `functions` package `add`/`subtract`/`multiply`/`divide`), not as Unit methods.
 * - `equalBase(other)` replaces the former `dimensionsEqual(other)`.
 * - Dimensions are a 9-element exponent array (incl. angle + bit), not a struct.
 * - `toBest()`, `to()`, `toSI()`, `simplify()`, `format()`, unit systems,
 *   `createUnit`, physical constants, and `°C`/`°F` parsing are all supported.
 * - `fromJSON` accepts both the `{ mathjs, … }` and the old `{ mathts, … }` envelopes.
 *
 * @module @danielsimonjr/mathts-core/types/unit
 */

// The merged Unit (a ready-instantiated class) + its factory. `UnitInstance` is the
// instance type — use it in type position (`(u: UnitInstance)`), since the merged
// `Unit` is a value (an instantiated constructor), not a class name that doubles as a type.
export { Unit, createUnitClass, unitDependencies } from './unit/index.js';
export type { UnitInstance } from './unit/index.js';

// Typed error classes — `catch (e) { e instanceof UnitParseError }` still works.
export { DimensionMismatchError, UnitParseError } from './unit/errors.js';

// Duck-typed guard (works across module boundaries and on the merged Unit).
export { isUnit } from '../is.js';

// Dimension helpers — unchanged, sourced from their canonical home.
export { DIMENSIONLESS, dim } from './unit-definitions.js';
export type { Dimensions, UnitDef } from './unit-definitions.js';
