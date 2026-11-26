/**
 * Compat sparse helpers (#1582): valueless-Unit constructor guard only.
 * Structural-zero storage lives in native `MathJSSparseMatrix` (`functions`).
 */

import { sanitizeDenseSparseInput } from './sparse-structural-zero.js';

/** Pass-through; native CSC sparse already matches mathjs 15.3.0 storage (#1582). */
export function ensureCompatSparse(m: unknown): unknown {
  return m;
}

/** Sanitize nested sparse input before `_factorySparse` (valueless Unit throw). */
export function sanitizeSparseNestedInput(data: unknown[][]): unknown[][] {
  return sanitizeDenseSparseInput(data);
}
