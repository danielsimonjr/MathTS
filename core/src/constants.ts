/**
 * Named mathematical constants (plain `number`).
 *
 * These mirror the constants documented in `docs/reference/constants.md` and the
 * familiar `Math.*` values, exported as first-class named bindings so callers can
 * `import { PI, E, TAU } from '@danielsimonjr/mathts-core'`. The imaginary unit
 * `I` and the type-specific constants (`COMPLEX_*`, `BIGNUMBER_*`, `FRACTION_*`)
 * live with their respective types.
 */

/** Ratio of a circle's circumference to its diameter. */
export const PI = Math.PI;
/** Euler's number, the base of the natural logarithm. */
export const E = Math.E;
/** Full-circle constant, `2·PI`. */
export const TAU = 2 * Math.PI;
/** Golden ratio, `(1 + √5) / 2`. */
export const PHI = (1 + Math.sqrt(5)) / 2;
/** Square root of 2. */
export const SQRT2 = Math.SQRT2;
/** Square root of one-half. */
export const SQRT1_2 = Math.SQRT1_2;
/** Natural logarithm of 2. */
export const LN2 = Math.LN2;
/** Natural logarithm of 10. */
export const LN10 = Math.LN10;
/** Base-2 logarithm of E. */
export const LOG2E = Math.LOG2E;
/** Base-10 logarithm of E. */
export const LOG10E = Math.LOG10E;
