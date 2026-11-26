/**
 * Behaviors compat deliberately does not match mathjs — only when parity is impossible.
 * #1585 (zeta, symbolicEqual, range) now matches mathjs in compat via adapters
 * (`compat/src/mathjs-parity-1585.ts`); see `docs/api/compat.md`.
 */
export const INTENTIONAL: Record<string, Array<{ label: string; assert: () => void }>> = {};
