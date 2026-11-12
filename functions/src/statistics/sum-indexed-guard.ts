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

  const same = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (a instanceof Complex && b instanceof Complex) return a.equals(b);
    return false;
  };
  if (!same(body, tail)) return;

  const isImaginaryUnit =
    body instanceof Complex && Math.abs(body.re) < 1e-12 && Math.abs(body.im - 1) < 1e-12;
  if (isImaginaryUnit) {
    throw new TypeError(
      "sum: dummy index 'i' is the imaginary unit; use summation(expr, index, lo, hi) instead"
    );
  }
  throw new TypeError(
    'sum: indexed summation sum(expr, index, lo, hi) is not supported; use summation(expr, index, lo, hi)'
  );
}
