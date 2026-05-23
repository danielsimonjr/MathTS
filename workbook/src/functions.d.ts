/**
 * Ambient type declaration for the slice of @danielsimonjr/mathts-functions
 * used by the workbook runtime.
 *
 * The functions package builds without `.d.ts` emit (its synced mathjs code
 * carries upstream type errors), so each consumer declares the surface it
 * uses — mirroring `compat/src/functions.d.ts`.
 */
declare module '@danielsimonjr/mathts-functions' {
  /**
   * Evaluate a math expression string against an optional variable scope.
   */
  export function evaluate(expr: string, scope?: Record<string, unknown>): unknown;
}
