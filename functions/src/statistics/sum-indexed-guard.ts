import { Complex } from '@danielsimonjr/mathts-core';

/**
 * Reject `sum(body, lo, hi, index)` mistaken for variadic addition (G21 / #721).
 * Does not special-case the string `"i"` — only the evaluated imaginary unit value.
 */
export function rejectMisusedIndexedSum(args: unknown[]): void {
  if (args.length !== 4) return;
  const [body, lo, hi, tail] = args;
  if (typeof lo !== 'number' || typeof hi !== 'number') return;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;

  // Only the imaginary unit is the textbook footgun (`sum(i, 1, 3, i)`).
  // Equal numbers (`sum(2, 1, 4, 2)`) and a scope variable named `i` are real variadic sums.
  const isImaginaryUnit = (v: unknown): boolean =>
    v instanceof Complex && Math.abs(v.re) < 1e-12 && Math.abs(v.im - 1) < 1e-12;
  if (!isImaginaryUnit(body) || !isImaginaryUnit(tail)) return;

  throw new TypeError(
    "sum: dummy index 'i' is the imaginary unit; use summation(expr, index, lo, hi) instead"
  );
}
