/**
 * Array Operations for AssemblyScript
 *
 * High-performance array operations using typed arrays.
 * These operations work directly on Float64Array data.
 */

// =============================================================================
// Reduction Operations
// =============================================================================

/**
 * Sum all elements in the array
 */
export function array_sum(data: Float64Array): f64 {
  let total: f64 = 0.0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    total += unchecked(data[i]);
  }
  return total;
}

/**
 * Product of all elements
 */
export function array_product(data: Float64Array): f64 {
  let product: f64 = 1.0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    product *= unchecked(data[i]);
  }
  return product;
}

/**
 * Mean (average) of all elements
 */
export function array_mean(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;
  return array_sum(data) / f64(len);
}

/**
 * Variance (population variance)
 */
export function array_variance(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;

  const mean = array_mean(data);
  let sumSqDiff: f64 = 0.0;

  for (let i = 0; i < len; i++) {
    const diff = unchecked(data[i]) - mean;
    sumSqDiff += diff * diff;
  }

  return sumSqDiff / f64(len);
}

/**
 * Standard deviation (population)
 */
export function array_stddev(data: Float64Array): f64 {
  return sqrt(array_variance(data));
}

/**
 * Minimum value
 */
export function array_min(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;

  let minVal = unchecked(data[0]);
  for (let i = 1; i < len; i++) {
    const val = unchecked(data[i]);
    if (val < minVal) minVal = val;
  }
  return minVal;
}

/**
 * Maximum value
 */
export function array_max(data: Float64Array): f64 {
  const len = data.length;
  if (len == 0) return f64.NaN;

  let maxVal = unchecked(data[0]);
  for (let i = 1; i < len; i++) {
    const val = unchecked(data[i]);
    if (val > maxVal) maxVal = val;
  }
  return maxVal;
}

/**
 * Index of minimum value
 */
export function array_argmin(data: Float64Array): i32 {
  const len = data.length;
  if (len == 0) return -1;

  let minIdx: i32 = 0;
  let minVal = unchecked(data[0]);

  for (let i: i32 = 1; i < len; i++) {
    const val = unchecked(data[i]);
    if (val < minVal) {
      minVal = val;
      minIdx = i;
    }
  }
  return minIdx;
}

/**
 * Index of maximum value
 */
export function array_argmax(data: Float64Array): i32 {
  const len = data.length;
  if (len == 0) return -1;

  let maxIdx: i32 = 0;
  let maxVal = unchecked(data[0]);

  for (let i: i32 = 1; i < len; i++) {
    const val = unchecked(data[i]);
    if (val > maxVal) {
      maxVal = val;
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * L2 norm (Euclidean norm)
 */
export function array_norm(data: Float64Array): f64 {
  let sumSq: f64 = 0.0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    const val = unchecked(data[i]);
    sumSq += val * val;
  }
  return sqrt(sumSq);
}

/**
 * L1 norm (sum of absolute values)
 */
export function array_norm_l1(data: Float64Array): f64 {
  let sum: f64 = 0.0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    sum += abs(unchecked(data[i]));
  }
  return sum;
}

/**
 * L-infinity norm (max absolute value)
 */
export function array_norm_linf(data: Float64Array): f64 {
  let maxAbs: f64 = 0.0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    const absVal = abs(unchecked(data[i]));
    if (absVal > maxAbs) maxAbs = absVal;
  }
  return maxAbs;
}

// =============================================================================
// Vector Operations
// =============================================================================

/**
 * Dot product of two arrays
 */
export function array_dot(a: Float64Array, b: Float64Array): f64 {
  const len = min(a.length, b.length);
  let result: f64 = 0.0;
  for (let i = 0; i < len; i++) {
    result += unchecked(a[i]) * unchecked(b[i]);
  }
  return result;
}

/**
 * Element-wise addition: result = a + b
 */
export function array_add(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) + unchecked(b[i]));
  }
}

/**
 * Element-wise subtraction: result = a - b
 */
export function array_sub(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) - unchecked(b[i]));
  }
}

/**
 * Element-wise multiplication: result = a * b
 */
export function array_mul(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) * unchecked(b[i]));
  }
}

/**
 * Element-wise division: result = a / b
 */
export function array_div(a: Float64Array, b: Float64Array, result: Float64Array): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) / unchecked(b[i]));
  }
}

/**
 * Scale array by scalar: result = a * scalar
 */
export function array_scale(a: Float64Array, scalar: f64, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) * scalar);
  }
}

/**
 * Add scalar to array: result = a + scalar
 */
export function array_add_scalar(a: Float64Array, scalar: f64, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) + scalar);
  }
}

/**
 * Negate array: result = -a
 */
export function array_neg(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = -unchecked(a[i]));
  }
}

/**
 * Absolute value: result = |a|
 */
export function array_abs(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = abs(unchecked(a[i])));
  }
}

/**
 * Square root: result = sqrt(a)
 */
export function array_sqrt(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = sqrt(unchecked(a[i])));
  }
}

/**
 * Square: result = a^2
 */
export function array_square(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    const val = unchecked(a[i]);
    unchecked(result[i] = val * val);
  }
}

/**
 * Exponential: result = Math.exp(a)
 */
export function array_exp(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = Math.exp(unchecked(a[i])));
  }
}

/**
 * Natural log: result = Math.log(a)
 */
export function array_log(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = Math.log(unchecked(a[i])));
  }
}

/**
 * Sine: result = Math.sin(a)
 */
export function array_sin(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = Math.sin(unchecked(a[i])));
  }
}

/**
 * Cosine: result = Math.cos(a)
 */
export function array_cos(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = Math.cos(unchecked(a[i])));
  }
}

// =============================================================================
// Linear Algebra Helpers
// =============================================================================

/**
 * Linear combination: result = alpha*a + beta*b (AXPBY)
 */
export function array_axpby(
  alpha: f64, a: Float64Array,
  beta: f64, b: Float64Array,
  result: Float64Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = alpha * unchecked(a[i]) + beta * unchecked(b[i]));
  }
}

/**
 * Euclidean distance between two vectors
 */
export function array_distance(a: Float64Array, b: Float64Array): f64 {
  const len = min(a.length, b.length);
  let sumSq: f64 = 0.0;
  for (let i = 0; i < len; i++) {
    const diff = unchecked(a[i]) - unchecked(b[i]);
    sumSq += diff * diff;
  }
  return sqrt(sumSq);
}

/**
 * Cosine similarity between two vectors
 */
export function array_cosine_similarity(a: Float64Array, b: Float64Array): f64 {
  const dot = array_dot(a, b);
  const normA = array_norm(a);
  const normB = array_norm(b);
  if (normA == 0.0 || normB == 0.0) return 0.0;
  return dot / (normA * normB);
}

// =============================================================================
// In-place Operations (modify input array)
// =============================================================================

/**
 * Scale array in place: a *= scalar
 */
export function array_scale_inplace(a: Float64Array, scalar: f64): void {
  const len = a.length;
  for (let i = 0; i < len; i++) {
    unchecked(a[i] = unchecked(a[i]) * scalar);
  }
}

/**
 * Add scalar in place: a += scalar
 */
export function array_add_scalar_inplace(a: Float64Array, scalar: f64): void {
  const len = a.length;
  for (let i = 0; i < len; i++) {
    unchecked(a[i] = unchecked(a[i]) + scalar);
  }
}

/**
 * Add arrays in place: a += b
 */
export function array_add_inplace(a: Float64Array, b: Float64Array): void {
  const len = min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    unchecked(a[i] = unchecked(a[i]) + unchecked(b[i]));
  }
}

/**
 * Clamp all values in place to [lo, hi]
 */
export function array_clamp_inplace(a: Float64Array, lo: f64, hi: f64): void {
  const len = a.length;
  for (let i = 0; i < len; i++) {
    const val = unchecked(a[i]);
    unchecked(a[i] = max(lo, min(hi, val)));
  }
}

/**
 * Fill array with value
 */
export function array_fill(a: Float64Array, value: f64): void {
  const len = a.length;
  for (let i = 0; i < len; i++) {
    unchecked(a[i] = value);
  }
}

/**
 * Copy array: dst = src
 */
export function array_copy(src: Float64Array, dst: Float64Array): void {
  const len = min(src.length, dst.length);
  for (let i = 0; i < len; i++) {
    unchecked(dst[i] = unchecked(src[i]));
  }
}
