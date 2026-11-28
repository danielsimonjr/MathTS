/**
 * mathjs 15.3.0 `lastDimToZeroBase` for expression transforms (#1786).
 * MathTS expression still uses the legacy 2-arg-only helper; compat mirrors mathjs.
 */
import { isBigNumber, isNumber } from '@danielsimonjr/mathts-core';
import type { BigNumber as CoreBigNumber } from '@danielsimonjr/mathts-core';

function isCollection(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as { isMatrix?: boolean }).isMatrix === true
  );
}

function isNumberOrBigNumber(n: unknown): boolean {
  return isNumber(n) || isBigNumber(n);
}

function dimToZeroBase(dim: unknown): unknown {
  if (isNumber(dim)) return (dim as number) - 1;
  if (isBigNumber(dim)) {
    const bn = dim as CoreBigNumber;
    if (typeof bn.sub === 'function') return bn.sub(1);
    const legacy = dim as { minus?: (n: number) => unknown };
    if (typeof legacy.minus === 'function') return legacy.minus(1);
    return dim;
  }
  return dim;
}

/** Change the last numeric argument (the dim) from one-based to zero-based. */
export function mathjsLastDimToZeroBase(args: unknown[]): unknown[] {
  if (args.length >= 2 && isCollection(args[0])) {
    for (let i = args.length - 1; i >= 1; i--) {
      if (isNumberOrBigNumber(args[i])) {
        const copy = args.slice();
        copy[i] = dimToZeroBase(copy[i]);
        return copy;
      }
    }
  }
  return args;
}
