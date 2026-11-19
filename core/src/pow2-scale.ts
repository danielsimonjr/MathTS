/**
 * Power-of-2 scaling for numerical kernels that square their entries (#1104, #1122).
 * One implementation: `matrix` and `functions` both import it from here.
 */

/**
 * Scale windows for the largest entry |a|max of a matrix, as exponents of 2 (#1104).
 * - `SQUARED`: a kernel that squares entries (norms, Householder and Givens vectors)
 *   overflows above about 2^512 and loses digits below about 2^-512.
 * - `FOURTH`: a kernel that forms fourth powers (the Wilkinson shift, sigma^2 of a
 *   bidiagonal step) overflows above about 2^256.
 * - `ABS_CUTOFF_LO`: a kernel with absolute cutoffs (1e-8 symmetry test, 1e-14 pivot
 *   floors) reads a tiny matrix as zero, so its window starts at 2^-20.
 */
export const SQUARED = 400;
export const FOURTH = 128;
export const ABS_CUTOFF_LO = -20;
/**
 * `UNIT_LO`: a kernel with an absolute 1e-14 pivot floor that cannot take a relative floor
 * (the AssemblyScript decompositions) reads a matrix with a largest entry below 2^-3 as
 * singular. Its window starts at 2^-3. An entry above 1 never loosens the floor, so a matrix
 * whose entries span a wide range keeps its small pivots (#1123).
 */
export const UNIT_LO = -3;

/**
 * `UNIT_FLOOR_LO`: a kernel with an absolute zero test of about 1e-15 on a residual that is
 * small relative to the largest entry. The window starts at 2^0, so the largest entry is at
 * least 1 and the test is at most 1e-15 relative to it (#1168).
 */
export const UNIT_FLOOR_LO = 0;

/**
 * The exponent `e` that moves `amax` into the window [2^lo, 2^hi]. It is 0 inside the
 * window and for a zero or non-finite `amax`. A larger `amax` goes to the top of the
 * window, [2^(hi-1), 2^hi); a smaller one goes to [1, 2). The edges are compared
 * directly, so a value at an edge is inside the window.
 */
export function pow2ScaleExponent(amax: number, lo: number, hi: number): number {
  if (!(amax > 0) || amax === Infinity) return 0;
  if (amax >= 2 ** lo && amax <= 2 ** hi) return 0;
  const k = Math.floor(Math.log2(amax));
  return amax > 2 ** hi ? hi - 1 - k : -k;
}

/** `x · 2^e`, exact; the factor is split in two so that 2^e itself cannot overflow. */
export function ldexp(x: number, e: number): number {
  const h = Math.trunc(e / 2);
  return x * 2 ** h * 2 ** (e - h);
}

/**
 * Scale every entry of `A` by 2^e in place. Each entry gets the same two products as
 * `ldexp`; the two factors are computed one time for the matrix, not one time for each entry.
 */
export function ldexpMatrix(A: number[][], e: number): void {
  const h = Math.trunc(e / 2);
  const f1 = 2 ** h;
  const f2 = 2 ** (e - h);
  for (const row of A) for (let j = 0; j < row.length; j++) row[j] = row[j] * f1 * f2;
}

/** The largest and the smallest nonzero |entry|; `finite` is false when an entry is NaN or infinite. */
export interface EntryRange {
  amax: number;
  amin: number;
  finite: boolean;
}

/** The entry range of a nested matrix or a flat array. It stops at the first NaN or infinite entry. */
export function entryRange(values: readonly (readonly number[])[] | ArrayLike<number>): EntryRange {
  let amax = 0;
  let amin = Infinity;
  const visit = (v: number): boolean => {
    const x = Math.abs(v);
    if (!(x < Infinity)) return false;
    if (x > amax) amax = x;
    if (x > 0 && x < amin) amin = x;
    return true;
  };
  const len = values.length;
  for (let i = 0; i < len; i++) {
    const item = (values as ArrayLike<number | readonly number[]>)[i];
    if (typeof item === 'number') {
      if (!visit(item)) return { amax, amin, finite: false };
    } else {
      for (let j = 0; j < item.length; j++)
        if (!visit(item[j])) return { amax, amin, finite: false };
    }
  }
  return { amax, amin, finite: true };
}

/** True when every number in a result (number, array, typed array or plain object) is finite. */
export function allFinite(x: unknown): boolean {
  if (typeof x === 'number') return Number.isFinite(x);
  if (x === null || typeof x !== 'object') return true;
  const t = x as { toFloat64Array?: () => Float64Array };
  if (typeof t.toFloat64Array === 'function') return allFinite(t.toFloat64Array());
  if (Array.isArray(x) || ArrayBuffer.isView(x)) {
    const a = x as unknown as ArrayLike<unknown>;
    for (let i = 0; i < a.length; i++) if (!allFinite(a[i])) return false;
    return true;
  }
  return Object.values(x).every(allFinite);
}

/**
 * Run a kernel with the input scaled into the window [2^lo, 2^hi] (#1104).
 * `run(e)` computes the result for the input times 2^e and returns it scaled back;
 * `run(0)` is the unscaled kernel. The rules:
 * - A matrix with a NaN or infinite entry, or one inside the window, takes `run(0)`.
 * - `even` makes `e` even (lower by one), so a square root of 2^e is exact.
 * - When 2^e would push a nonzero entry below 2^-1022 (the entries span more than the
 *   double range), the unscaled result is kept when it is finite. A finite result can
 *   still be wrong (#1129), so a kernel that can tell passes `accept`: both runs are
 *   made, and the unscaled one is kept only when `accept(unscaled, scaled)` is true.
 */
export function withPow2Scale<T>(
  range: EntryRange,
  lo: number,
  hi: number,
  run: (e: number) => T,
  even = false,
  accept?: (unscaled: T, scaled: T) => boolean
): T {
  if (!range.finite) return run(0);
  let e = pow2ScaleExponent(range.amax, lo, hi);
  if (even && e % 2 !== 0) e -= 1;
  if (e === 0) return run(0);
  if (e < 0 && ldexp(range.amin, e) < 2 ** -1022) {
    let unscaled: T | undefined;
    let ok = true;
    try {
      unscaled = run(0);
    } catch {
      ok = false;
    }
    if (ok && allFinite(unscaled)) {
      if (accept === undefined) return unscaled as T;
      const scaled = run(e);
      return accept(unscaled as T, scaled) ? (unscaled as T) : scaled;
    }
  }
  return run(e);
}

/**
 * Run `kernel` on `input` scaled by 2^e, and scale the result back (#1212). It wraps
 * `withPow2Scale` for the common case: a kernel that takes one input and has no `even` or
 * `accept` rule. The caller states only what differs:
 * - `kernel` does not change `input`: `withPow2Scale` can run it two times.
 * - `scale(input, e)` returns a new input equal to `input` times 2^e. It runs only when
 *   `e` is not 0; for `e` equal to 0 the kernel gets `input` as it is.
 * - `unscale(result, e)` undoes the scaling on the kernel result. It runs only when `e` is
 *   not 0. Leave it out when the result does not depend on the scale (a condition number).
 */
export function withPow2ScaledKernel<I, R>(
  range: EntryRange,
  lo: number,
  hi: number,
  input: I,
  scale: (input: I, e: number) => I,
  kernel: (input: I) => R,
  unscale?: (result: R, e: number) => R
): R {
  return withPow2Scale(range, lo, hi, (e) => {
    if (e === 0) return kernel(input);
    const result = kernel(scale(input, e));
    return unscale === undefined ? result : unscale(result, e);
  });
}
