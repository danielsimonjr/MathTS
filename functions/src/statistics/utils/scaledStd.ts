import { BigNumber } from '@danielsimonjr/mathts-core';
import { realScale, squaresLeaveRange } from '../../utils/real-scale.js';

type Real = number | BigNumber;

/** The arithmetic of one real type, so the scaled formula is written once. */
interface Ops {
  add(a: Real, b: Real): Real;
  sub(a: Real, b: Real): Real;
  mul(a: Real, b: Real): Real;
  div(a: Real, n: number): Real;
  sqrt(a: Real): Real;
}

const numberOps: Ops = {
  add: (a, b) => (a as number) + (b as number),
  sub: (a, b) => (a as number) - (b as number),
  mul: (a, b) => (a as number) * (b as number),
  div: (a, n) => (a as number) / n,
  sqrt: (a) => Math.sqrt(a as number),
};

const bigOps: Ops = {
  add: (a, b) => (a as BigNumber).add(b as BigNumber),
  sub: (a, b) => (a as BigNumber).subtract(b as BigNumber),
  mul: (a, b) => (a as BigNumber).multiply(b as BigNumber),
  div: (a, n) => (a as BigNumber).divide(n),
  sqrt: (a) => (a as BigNumber).sqrt(),
};

/**
 * The standard deviation of finite numbers and BigNumbers, computed so that no square leaves the
 * range of the type (#1257). The values are divided by an exact scale s0 (a power of 2 for
 * numbers, a power of 10 for BigNumbers). Their deviations from the mean are divided by a second
 * exact scale s1. The result is s0 * s1 * sqrt(sum((d / s1)^2) / divisor).
 *
 * Returns `undefined` when the plain computation has no better answer: a value that is not
 * finite, not a number or a BigNumber, a constant list or a single value (the deviation is 0), or
 * a divisor below 1.
 */
export function scaledStd(
  leaves: readonly unknown[],
  divisorOf: (n: number) => number
): Real | undefined {
  const n = leaves.length;
  const divisor = divisorOf(n);
  if (n === 0 || !(divisor >= 1)) return undefined;
  const s0 = realScale(leaves);
  if (s0 === undefined) return undefined;
  const ops = s0.big ? bigOps : numberOps;
  const y = leaves.map((v) => s0.down(v as Real));
  let sum = y[0];
  for (let i = 1; i < n; i++) sum = ops.add(sum, y[i]);
  const mean = ops.div(sum, n);
  const d = y.map((v) => ops.sub(v, mean));
  const s1 = realScale(d);
  if (s1 === undefined) return undefined;
  let ssd: Real | undefined;
  for (const v of d) {
    const z = s1.down(v);
    const sq = ops.mul(z, z);
    ssd = ssd === undefined ? sq : ops.add(ssd, sq);
  }
  return s0.up(s1.up(ops.sqrt(ops.div(ssd as Real, divisor))));
}

/** The divisor of a normalization name, or `undefined` for an unknown name. */
export function normalizationDivisor(normalization: string): ((n: number) => number) | undefined {
  switch (normalization) {
    case 'unbiased':
      return (n) => n - 1;
    case 'uncorrected':
      return (n) => n;
    case 'biased':
      return (n) => n + 1;
    default:
      return undefined;
  }
}

/**
 * The result to return when the plain std is NaN, infinite or 0 and `scaled` is the scaled
 * recomputation (`undefined` when it does not apply). A plain NaN or infinity is a square that
 * overflowed, so the scaled result replaces it. A plain 0 is a defect only when the variance
 * underflowed, that is when the square of the scaled result leaves the range of the type. Else
 * the plain 0 stays: the scaled formula sums in a different order, so on values whose deviations
 * cancel to 0 it gives rounding noise instead (#1257).
 */
export function pickScaledStd(plain: unknown, scaled: Real | undefined): unknown {
  if (scaled === undefined) return plain;
  const plainZero = plain instanceof BigNumber ? plain.isZero() : plain === 0;
  if (!plainZero) return scaled;
  return squareUnderflows(scaled) ? scaled : plain;
}

/** The square of `r` is 0 or below the smallest positive normal value of the type. */
function squareUnderflows(r: Real): boolean {
  if (r instanceof BigNumber) return r.isZero() || squaresLeaveRange(r.e, 1);
  return r * r < MIN_NORMAL;
}

/** The smallest positive normal double, 2^-1022. */
const MIN_NORMAL = 2 ** -1022;
