/**
 * Typed error classes for the Unit. Kept in their own module (with no Unit
 * imports) so both the merged `Unit` (`Unit.ts`) and the `core/src/types/unit.ts`
 * compatibility surface can import them without a circular dependency, and so
 * callers can `catch (e) { if (e instanceof UnitParseError) … }` as before the
 * two Unit implementations merged.
 */

/** Thrown when a unit notation string cannot be parsed against the registry. */
export class UnitParseError extends Error {
  readonly name = 'UnitParseError';
  constructor(message: string) {
    super(message);
  }
}

/** Thrown when an operation requires two units to share a base dimension and they do not. */
export class DimensionMismatchError extends Error {
  readonly name = 'DimensionMismatchError';
  constructor(message: string) {
    super(message);
  }
}
