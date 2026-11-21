/**
 * The rounding of the BigNumber loops of `combinations`, `combinationsWithRep`, `permutations`
 * and `multinomial` (#1164): the exact bigint loop, or a working-precision loop with a proof that
 * its result is the exact value rounded one time. Not exported from the package barrel.
 */
import { BigNumber } from '@danielsimonjr/mathts-core';
import { withWorkPrecision } from '../utils/bignumber/work-precision.js';
import { binomialBigInt } from './bigint-binomial.js';

/**
 * A bigint result as a BigNumber rounded one time to the precision. The BigNumber product of the
 * same factors rounds at every step, and the digits of that result depend on the order of the steps.
 */
function roundedBigNumber(value: bigint): BigNumber {
  return BigNumber.fromBigInt(value).toSignificantDigits(BigNumber.precision);
}

/**
 * The cost model that selects the exact bigint loop or the working-precision loop.
 *
 * The unit is one limb operation: one 64-bit limb of a product of an n-limb number by a one-limb
 * number. A product of an n-limb number by an m-limb number costs n * m units (schoolbook; the
 * engine is faster for large equal sizes, so this is an upper bound), and a division costs the
 * limbs of its quotient times the limbs of its divisor. Let `b` be the limbs of the largest factor
 * `top` and `w` the limbs of the working precision.
 *
 * - Exact loop, step `i`: the partial result has about `i * b` limbs; one product by a factor of
 *   `b` limbs and one division by a one-limb divisor: `i * b * (b + 1)` units, plus
 *   `EXACT_OP_OVERHEAD` per bigint operation. A loop of `s` steps costs `s^2 / 2 * b * (b + 1)`.
 *   The product tree of `rangeProductBigInt` costs at most the same.
 * - Working loop, one multiply: the product of `w` by `b` limbs and the division that rounds it
 *   back to `w` digits: `2 * w * b` units. One divide by a one-limb number: the dividend is scaled
 *   by `10^(w digits)` (`w * w`) and the quotient is rounded back (`w * w`): `2 * w * w` units.
 *   Each BigNumber operation adds `WORK_OP_OVERHEAD` units (allocation, digit count, rounding
 *   test).
 *
 * The two overheads are the only measured values. Measured with `BigNumber` at precision 64:
 * `EXACT_OP_OVERHEAD` 24 to 26 units on Node 26 and 11 on Bun 1.4; `WORK_OP_OVERHEAD` 544 to 676
 * units on Node 26 and 239 on Bun 1.4 (the constants are the geometric means). An error of a
 * factor `f` in a constant makes the chosen loop cost at most `f` times the cheaper loop, and it
 * never changes a result: both loops give the exact value rounded one time.
 */
const LIMB_BITS = 64;
const EXACT_OP_OVERHEAD = 16;
const WORK_OP_OVERHEAD = 400;
/** A decimal digit holds log2(10) bits. */
const BITS_PER_DIGIT = Math.log2(10);

/** The 64-bit limbs of a positive bigint. */
function limbsOf(value: bigint): number {
  return Math.ceil(value.toString(16).length / (LIMB_BITS / 4));
}

/** The shape of a loop of products: its steps, its largest factor, its operations per step. */
export interface LoopShape {
  /** The count of steps. */
  readonly steps: bigint;
  /** The largest factor of a step. */
  readonly top: bigint;
  /** True when each step also divides by its step number (a binomial loop). */
  readonly divides: boolean;
  /** The count of BigNumber operations of the working loop; each one can round. */
  readonly operations: number;
}

/** True when the exact bigint loop of `shape` costs no more than the working loop. */
export function exactLoopIsCheaper(shape: LoopShape): boolean {
  const s = Number(shape.steps);
  const b = limbsOf(shape.top);
  const w = Math.ceil(
    (workPrecision(shape.operations, ZIV_START_GUARD) * BITS_PER_DIGIT) / LIMB_BITS
  );
  const opsPerStep = shape.divides ? 2 : 1;
  const exact = (s * s * b * (b + 1)) / 2 + s * opsPerStep * EXACT_OP_OVERHEAD;
  const multiply = 2 * w * b + WORK_OP_OVERHEAD;
  const divide = shape.divides ? 2 * w * w + WORK_OP_OVERHEAD : 0;
  return exact <= s * (multiply + divide);
}

/**
 * The working-precision loop and its rounding proof (a Ziv test).
 *
 * Each BigNumber multiply rounds its result to `p` digits with an error below one unit in the
 * last place, for every rounding mode, so its relative error is at most `10^(1 - p)`. A divide
 * truncates a quotient of at least `p + 10` digits and then rounds it: at most `2 * 10^(1 - p)`.
 * The factors convert exactly. With `m` operations and `u = 2 * 10^(1 - p)`, the computed value is
 * `exact * (1 + t)` with `|t| <= 2 * m * u` while `m * u <= 1/4`, so the exact value lies in
 * `[a * (1 - e), a * (1 + e)]` for `e = 4 * m * u = 8 * m * 10^(1 - p)`. The two ends are exact
 * (bigint arithmetic). When both ends round to the same value at the precision of the call, the
 * exact value rounds to it too, because every rounding mode is monotone: the result is the exact
 * value rounded one time. When they differ, the loop runs again with twice the guard digits.
 *
 * Each exact partial value of the loops is at most `result * top`. When that has no more digits
 * than the working precision, no step rounded and the computed value is exact. After
 * `ZIV_ATTEMPTS` tries (an exact value within the error of a rounding boundary, or a tie) the
 * exact bigint loop gives the result.
 */
const ZIV_START_GUARD = 10;
const ZIV_ATTEMPTS = 3;

/** The working precision of `operations` rounding operations with `guard` guard digits. */
function workPrecision(operations: number, guard: number): number {
  return BigNumber.precision + String(8 * operations).length + guard;
}

/**
 * The two ends of the error interval of `approx`, which came from `operations` rounding operations
 * at `precision` digits, each rounded one time to the precision of the call.
 */
function roundedInterval(
  approx: BigNumber,
  operations: number,
  precision: number
): [BigNumber, BigNumber] {
  // approx = c * 10^(order - digits + 1), with `digits` significant digits.
  const [mantissa, order] = approx.toExponential().split('e') as [string, string];
  const digits = mantissa.replace('.', '');
  const c = BigInt(digits);
  // The ends c * 10^(precision - 1) -+ c * 8 * operations, times 10^(scale).
  const centre = c * 10n ** BigInt(precision - 1);
  const radius = c * BigInt(8 * operations);
  const scale = BigNumber.parse(`1e${Number(order) - digits.length + 2 - precision}`);
  return [
    BigNumber.fromBigInt(centre - radius).times(scale),
    BigNumber.fromBigInt(centre + radius).times(scale),
  ];
}

/**
 * The value of a loop of `shape`, rounded one time to the precision: the exact bigint loop when
 * the cost model says it is the cheaper one, else the working loop with its rounding proof.
 */
export function roundedLoop(
  shape: LoopShape,
  work: () => BigNumber,
  exact: () => bigint
): BigNumber {
  if (exactLoopIsCheaper(shape)) return roundedBigNumber(exact());
  return roundedWorkLoop(shape, work, exact);
}

/**
 * The working loop of `shape` with its rounding proof, rounded one time to the precision. The
 * first try has `startGuard` guard digits; each later try has twice as many.
 */
export function roundedWorkLoop(
  shape: LoopShape,
  work: () => BigNumber,
  exact: () => bigint,
  startGuard: number = ZIV_START_GUARD
): BigNumber {
  const precision = BigNumber.precision;
  const operations = shape.operations;
  // An upper bound of the digits of `top` from its bits: the decimal string of a large operand
  // costs more than the loop.
  const topDigits = Math.floor(shape.top.toString(16).length * 4 * Math.log10(2)) + 1;
  for (let attempt = 0, guard = startGuard; attempt < ZIV_ATTEMPTS; attempt++, guard *= 2) {
    const p = workPrecision(operations, guard);
    const approx = withWorkPrecision(BigNumber, p, work);
    // The exact value is below 2 * approx, so it has at most approx.e + 2 digits.
    if (approx.e + 2 + topDigits <= p) return approx.toSignificantDigits(precision);
    const [lo, hi] = roundedInterval(approx, operations, p);
    if (lo.equals(hi)) return lo;
  }
  return roundedBigNumber(exact());
}

/**
 * C(total, steps) by the multiplicative loop at the current precision. Each partial result is a
 * binomial coefficient, so it is not larger than the result.
 */
export function binomialLoop(total: bigint, steps: bigint): BigNumber {
  let result = BigNumber.fromNumber(1);
  for (let i = 1n; i <= steps; i++) {
    result = result.times(BigNumber.fromBigInt(total - steps + i)).div(BigNumber.fromBigInt(i));
  }
  return result;
}

/** A loop of `roundedLoop`: its shape, its working loop and its exact bigint loop. */
export interface RoundedLoopParts {
  /** The shape of the loop. */
  readonly shape: LoopShape;
  /** The working loop at the current precision. */
  readonly work: () => BigNumber;
  /** The exact bigint loop. */
  readonly exact: () => bigint;
}

/**
 * The loops of the Catalan number C(2n, n) / (n + 1). The working loop is the binomial loop and
 * one divide: 2n + 1 roundings. Each partial value is at most C(2n, n) * 2n = result * 2n(n + 1).
 */
export function catalanLoop(n: bigint): RoundedLoopParts {
  return {
    shape: { steps: n, top: 2n * n * (n + 1n), divides: true, operations: 2 * Number(n) + 1 },
    work: () => binomialLoop(2n * n, n).div(BigNumber.fromBigInt(n + 1n)),
    exact: () => binomialBigInt(2n * n, n) / (n + 1n),
  };
}

/** The Catalan number of a non-negative bigint, rounded one time to the precision. */
export function roundedCatalan(n: bigint): BigNumber {
  const { shape, work, exact } = catalanLoop(n);
  return roundedLoop(shape, work, exact);
}

/**
 * The Bell triangle of `n` rows on values of type `T`: row m starts with the last entry of row
 * m - 1, and each next entry is the sum of the entry before it and the entry above that one.
 * Returns B(n), the first entry of the last row.
 */
function bellTriangle<T>(n: number, one: T, add: (x: T, y: T) => T): T {
  let row: T[] = [one];
  for (let m = 1; m <= n; m++) {
    const next: T[] = [row[row.length - 1] as T];
    for (let j = 0; j < row.length; j++) next.push(add(next[j] as T, row[j] as T));
    row = next;
  }
  return row[0] as T;
}

/**
 * The loops of the Bell number B(n): the Bell triangle at a working precision and on bigints.
 * A sum of positive values with relative errors at most `a` has a relative error at most `a`
 * before its rounding, so the bound of `roundedWorkLoop` holds with the longest chain of
 * roundings behind an entry: entry j of row m has d(m - 1) + j additions behind it, so
 * d(n) <= n(n + 1) / 2. Every entry is at most B(n + 1) <= 2^n B(n), because
 * B(n + 1) = sum C(n, k) B(k) and B increases.
 */
export function bellLoop(n: number): RoundedLoopParts {
  return {
    shape: {
      steps: BigInt(n),
      top: 1n << BigInt(n),
      divides: false,
      operations: (n * (n + 1)) / 2 + 1,
    },
    work: () => bellTriangle(n, BigNumber.fromNumber(1), (x, y) => x.plus(y)),
    exact: () => bellTriangle(n, 1n, (x, y) => x + y),
  };
}

/**
 * The Bell number B(n), rounded one time to the precision. The triangle has O(n^2) additions of
 * long values, so the cost model of the products does not apply: the working triangle runs, and
 * the exact triangle only as the last fallback.
 */
export function roundedBell(n: number): BigNumber {
  const { shape, work, exact } = bellLoop(n);
  return roundedWorkLoop(shape, work, exact);
}
