/**
 * Number fast path of the unary scalar shims (#889).
 *
 * Internal: not re-exported from the package entry, so the public export surface is unchanged.
 * `shims.ts` builds each shim from this table, and `index.ts` reads it to skip the config
 * wrapper for a lone number argument.
 */

/** The number fast path of one unary shim: the Math function and its real domain. */
export interface UnaryNumberFastPath {
  readonly fastNumber: (x: number) => number;
  readonly inReal: (x: number) => boolean;
}

const ALL_REAL: (x: number) => boolean = () => true;

/** Number fast path per unary scalar shim. */
export const UNARY_NUMBER_FAST_PATH = {
  sin: { fastNumber: Math.sin, inReal: ALL_REAL },
  cos: { fastNumber: Math.cos, inReal: ALL_REAL },
  tan: { fastNumber: Math.tan, inReal: ALL_REAL },
  asin: { fastNumber: Math.asin, inReal: (x: number) => x >= -1 && x <= 1 },
  acos: { fastNumber: Math.acos, inReal: (x: number) => x >= -1 && x <= 1 },
  atan: { fastNumber: Math.atan, inReal: ALL_REAL },
  sqrt: { fastNumber: Math.sqrt, inReal: (x: number) => x >= 0 },
  abs: { fastNumber: Math.abs, inReal: ALL_REAL },
  exp: { fastNumber: Math.exp, inReal: ALL_REAL },
  log: { fastNumber: Math.log, inReal: (x: number) => x >= 0 },
} as const satisfies Record<string, UnaryNumberFastPath>;
