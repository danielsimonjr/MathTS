/**
 * Shared symbolic antiderivatives for CAS integrate paths (G21).
 */

/** Antiderivative of 1/x with respect to `varName` on the real line (x ≠ 0). */
export function antiderivativeReciprocal(varName: string): string {
  return `log(abs(${varName}))`;
}
