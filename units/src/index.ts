/**
 * @danielsimonjr/mathts-units
 *
 * Standalone units & dimensional analysis for MathTS. Re-exports the unit system
 * from {@link @danielsimonjr/mathts-core} -- the `Unit` class, the unit registry
 * (base/derived/all units + aliases), SI prefixes, and the dimensional-analysis
 * errors -- as a focused package. The implementation lives in core; this is an
 * entry point, not a copy.
 *
 * @packageDocumentation
 */

export {
  Unit,
  isUnit,
  isUnitValue,
  DimensionMismatchError,
  UnitParseError,
  DIMENSIONLESS,
  dim,
  BASE_UNITS,
  DERIVED_UNITS,
  ALL_UNITS,
  UNIT_ALIASES,
  getUnitDef,
  SI_PREFIXES,
  BEST_PREFIXES,
  getPrefix,
} from '@danielsimonjr/mathts-core';

export type { Dimensions, UnitDef } from '@danielsimonjr/mathts-core';
