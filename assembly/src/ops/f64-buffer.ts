/**
 * Shared Float64Array buffer helpers (Sprint 2R clone-merge G0–G5).
 * @inline keeps loops in export call sites.
 */

/** Minimum value; empty buffer → NaN. */
@inline
export function f64Min(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;

  let minVal = unchecked(data[0]);
  for (let i = 1; i < len; i++) {
    const val = unchecked(data[i]);
    if (val < minVal) minVal = val;
  }
  return minVal;
}

/** Maximum value; empty buffer → NaN. */
@inline
export function f64Max(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;

  let maxVal = unchecked(data[0]);
  for (let i = 1; i < len; i++) {
    const val = unchecked(data[i]);
    if (val > maxVal) maxVal = val;
  }
  return maxVal;
}

/** Element-wise addition: result = a + b (length = min of inputs and result). */
@inline
export function f64Add(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) + unchecked(b[i])));
  }
}

/** Element-wise subtraction: result = a - b. */
@inline
export function f64Sub(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) - unchecked(b[i])));
  }
}

/** Element-wise multiplication: result = a * b. */
@inline
export function f64Mul(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) * unchecked(b[i])));
  }
}

/** Element-wise division: result = a / b. */
@inline
export function f64Div(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) / unchecked(b[i])));
  }
}
