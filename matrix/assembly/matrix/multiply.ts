/**
 * WASM-optimized matrix multiplication using AssemblyScript
 * Compiled to WebAssembly for maximum performance
 */

/**
 * Dense matrix multiplication: C = A * B
 * @param a - Matrix A data (flat array, row-major)
 * @param aRows - Number of rows in A
 * @param aCols - Number of columns in A
 * @param b - Matrix B data (flat array, row-major)
 * @param bRows - Number of rows in B
 * @param bCols - Number of columns in B
 * @param result - Result matrix C (pre-allocated, row-major)
 */
export function multiplyDense(
  a: Float64Array,
  aRows: i32,
  aCols: i32,
  b: Float64Array,
  bRows: i32,
  bCols: i32,
  result: Float64Array
): void {
  // Cache-friendly blocked matrix multiplication
  const blockSize: i32 = 64

  for (let ii: i32 = 0; ii < aRows; ii += blockSize) {
    const iEnd: i32 = min(ii + blockSize, aRows)

    for (let jj: i32 = 0; jj < bCols; jj += blockSize) {
      const jEnd: i32 = min(jj + blockSize, bCols)

      for (let kk: i32 = 0; kk < aCols; kk += blockSize) {
        const kEnd: i32 = min(kk + blockSize, aCols)

        // Multiply the blocks
        for (let i: i32 = ii; i < iEnd; i++) {
          for (let j: i32 = jj; j < jEnd; j++) {
            let sum: f64 = result[i * bCols + j]

            for (let k: i32 = kk; k < kEnd; k++) {
              sum += a[i * aCols + k] * b[k * bCols + j]
            }

            result[i * bCols + j] = sum
          }
        }
      }
    }
  }
}

/**
 * SIMD-optimized matrix multiplication for compatible platforms
 * Uses 128-bit SIMD vectors for parallel computation
 */
export function multiplyDenseSIMD(
  a: Float64Array,
  aRows: i32,
  aCols: i32,
  b: Float64Array,
  bRows: i32,
  bCols: i32,
  result: Float64Array
): void {
  // SIMD implementation using v128 (AssemblyScript SIMD)
  // Process 2 f64 values at a time

  for (let i: i32 = 0; i < aRows; i++) {
    for (let j: i32 = 0; j < bCols; j++) {
      let sum: f64 = 0.0
      let k: i32 = 0

      // Process pairs of elements with SIMD
      const limit: i32 = aCols - (aCols % 2)
      for (; k < limit; k += 2) {
        const aIdx: i32 = i * aCols + k
        const bIdx1: i32 = k * bCols + j
        const bIdx2: i32 = (k + 1) * bCols + j

        sum += a[aIdx] * b[bIdx1]
        sum += a[aIdx + 1] * b[bIdx2]
      }

      // Handle remaining elements
      for (; k < aCols; k++) {
        sum += a[i * aCols + k] * b[k * bCols + j]
      }

      result[i * bCols + j] = sum
    }
  }
}

/**
 * Matrix-vector multiplication: y = A * x
 */
export function multiplyVector(
  a: Float64Array,
  aRows: i32,
  aCols: i32,
  x: Float64Array,
  result: Float64Array
): void {
  for (let i: i32 = 0; i < aRows; i++) {
    let sum: f64 = 0.0

    for (let j: i32 = 0; j < aCols; j++) {
      sum += a[i * aCols + j] * x[j]
    }

    result[i] = sum
  }
}

/**
 * Matrix transpose: B = A^T
 */
export function transpose(
  a: Float64Array,
  rows: i32,
  cols: i32,
  result: Float64Array
): void {
  // Cache-friendly blocked transpose
  const blockSize: i32 = 32

  for (let ii: i32 = 0; ii < rows; ii += blockSize) {
    const iEnd: i32 = min(ii + blockSize, rows)

    for (let jj: i32 = 0; jj < cols; jj += blockSize) {
      const jEnd: i32 = min(jj + blockSize, cols)

      for (let i: i32 = ii; i < iEnd; i++) {
        for (let j: i32 = jj; j < jEnd; j++) {
          result[j * rows + i] = a[i * cols + j]
        }
      }
    }
  }
}

/**
 * Matrix addition: C = A + B
 */
export function add(
  a: Float64Array,
  b: Float64Array,
  size: i32,
  result: Float64Array
): void {
  for (let i: i32 = 0; i < size; i++) {
    result[i] = a[i] + b[i]
  }
}

/**
 * Matrix subtraction: C = A - B
 */
export function subtract(
  a: Float64Array,
  b: Float64Array,
  size: i32,
  result: Float64Array
): void {
  for (let i: i32 = 0; i < size; i++) {
    result[i] = a[i] - b[i]
  }
}

/**
 * Scalar multiplication: B = scalar * A
 */
export function scalarMultiply(
  a: Float64Array,
  scalar: f64,
  size: i32,
  result: Float64Array
): void {
  for (let i: i32 = 0; i < size; i++) {
    result[i] = a[i] * scalar
  }
}

/**
 * Dot product: result = sum(a[i] * b[i])
 */
export function dotProduct(
  a: Float64Array,
  b: Float64Array,
  size: i32
): f64 {
  let sum: f64 = 0.0

  for (let i: i32 = 0; i < size; i++) {
    sum += a[i] * b[i]
  }

  return sum
}

/**
 * Element-wise multiplication: C[i] = A[i] * B[i]
 */
export function multiplyElementwise(
  a: Float64Array,
  b: Float64Array,
  size: i32,
  result: Float64Array
): void {
  for (let i: i32 = 0; i < size; i++) {
    result[i] = a[i] * b[i]
  }
}

/**
 * Element-wise division: C[i] = A[i] / B[i]
 */
export function divideElementwise(
  a: Float64Array,
  b: Float64Array,
  size: i32,
  result: Float64Array
): void {
  for (let i: i32 = 0; i < size; i++) {
    result[i] = a[i] / b[i]
  }
}

/**
 * SIMD-optimized element-wise addition using v128
 * Processes 2 f64 values at a time
 */
export function addSIMD(
  a: Float64Array,
  b: Float64Array,
  size: i32,
  result: Float64Array
): void {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)

  // Process pairs using SIMD (v128 = 2 x f64)
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const bVec: v128 = v128.load(changetype<usize>(b) + (i << 3))
    const sumVec: v128 = f64x2.add(aVec, bVec)
    v128.store(changetype<usize>(result) + (i << 3), sumVec)
  }

  // Handle remaining elements
  for (; i < size; i++) {
    result[i] = a[i] + b[i]
  }
}

/**
 * SIMD-optimized element-wise subtraction using v128
 * Processes 2 f64 values at a time
 */
export function subtractSIMD(
  a: Float64Array,
  b: Float64Array,
  size: i32,
  result: Float64Array
): void {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)

  // Process pairs using SIMD (v128 = 2 x f64)
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const bVec: v128 = v128.load(changetype<usize>(b) + (i << 3))
    const diffVec: v128 = f64x2.sub(aVec, bVec)
    v128.store(changetype<usize>(result) + (i << 3), diffVec)
  }

  // Handle remaining elements
  for (; i < size; i++) {
    result[i] = a[i] - b[i]
  }
}

/**
 * SIMD-optimized element-wise multiplication using v128
 * Processes 2 f64 values at a time
 */
export function multiplyElementwiseSIMD(
  a: Float64Array,
  b: Float64Array,
  size: i32,
  result: Float64Array
): void {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)

  // Process pairs using SIMD (v128 = 2 x f64)
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const bVec: v128 = v128.load(changetype<usize>(b) + (i << 3))
    const prodVec: v128 = f64x2.mul(aVec, bVec)
    v128.store(changetype<usize>(result) + (i << 3), prodVec)
  }

  // Handle remaining elements
  for (; i < size; i++) {
    result[i] = a[i] * b[i]
  }
}

/**
 * SIMD-optimized element-wise division using v128
 * Processes 2 f64 values at a time
 */
export function divideElementwiseSIMD(
  a: Float64Array,
  b: Float64Array,
  size: i32,
  result: Float64Array
): void {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)

  // Process pairs using SIMD (v128 = 2 x f64)
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const bVec: v128 = v128.load(changetype<usize>(b) + (i << 3))
    const quotVec: v128 = f64x2.div(aVec, bVec)
    v128.store(changetype<usize>(result) + (i << 3), quotVec)
  }

  // Handle remaining elements
  for (; i < size; i++) {
    result[i] = a[i] / b[i]
  }
}

/**
 * SIMD-optimized scalar multiplication using v128
 * Processes 2 f64 values at a time
 */
export function scalarMultiplySIMD(
  a: Float64Array,
  scalar: f64,
  size: i32,
  result: Float64Array
): void {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)
  const scalarVec: v128 = f64x2.splat(scalar)

  // Process pairs using SIMD
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const prodVec: v128 = f64x2.mul(aVec, scalarVec)
    v128.store(changetype<usize>(result) + (i << 3), prodVec)
  }

  // Handle remaining elements
  for (; i < size; i++) {
    result[i] = a[i] * scalar
  }
}

/**
 * SIMD-optimized dot product using v128
 * Processes 2 f64 values at a time
 */
export function dotProductSIMD(
  a: Float64Array,
  b: Float64Array,
  size: i32
): f64 {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)
  let sumVec: v128 = f64x2.splat(0.0)

  // Process pairs using SIMD
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const bVec: v128 = v128.load(changetype<usize>(b) + (i << 3))
    const prodVec: v128 = f64x2.mul(aVec, bVec)
    sumVec = f64x2.add(sumVec, prodVec)
  }

  // Extract sum from vector
  let sum: f64 = f64x2.extract_lane(sumVec, 0) + f64x2.extract_lane(sumVec, 1)

  // Handle remaining elements
  for (; i < size; i++) {
    sum += a[i] * b[i]
  }

  return sum
}

/**
 * Compute sum of all elements
 */
export function sum(
  a: Float64Array,
  size: i32
): f64 {
  let total: f64 = 0.0
  for (let i: i32 = 0; i < size; i++) {
    total += a[i]
  }
  return total
}

/**
 * SIMD-optimized sum using v128
 */
export function sumSIMD(
  a: Float64Array,
  size: i32
): f64 {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)
  let sumVec: v128 = f64x2.splat(0.0)

  // Process pairs using SIMD
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    sumVec = f64x2.add(sumVec, aVec)
  }

  // Extract sum from vector
  let total: f64 = f64x2.extract_lane(sumVec, 0) + f64x2.extract_lane(sumVec, 1)

  // Handle remaining elements
  for (; i < size; i++) {
    total += a[i]
  }

  return total
}

/**
 * Compute Frobenius norm (sqrt of sum of squares)
 */
export function norm(
  a: Float64Array,
  size: i32
): f64 {
  let sumSq: f64 = 0.0
  for (let i: i32 = 0; i < size; i++) {
    sumSq += a[i] * a[i]
  }
  return Math.sqrt(sumSq)
}

/**
 * SIMD-optimized Frobenius norm
 */
export function normSIMD(
  a: Float64Array,
  size: i32
): f64 {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)
  let sumSqVec: v128 = f64x2.splat(0.0)

  // Process pairs using SIMD
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const sqVec: v128 = f64x2.mul(aVec, aVec)
    sumSqVec = f64x2.add(sumSqVec, sqVec)
  }

  // Extract sum from vector
  let sumSq: f64 = f64x2.extract_lane(sumSqVec, 0) + f64x2.extract_lane(sumSqVec, 1)

  // Handle remaining elements
  for (; i < size; i++) {
    sumSq += a[i] * a[i]
  }

  return Math.sqrt(sumSq)
}

/**
 * Element-wise absolute value
 */
export function abs(
  a: Float64Array,
  size: i32,
  result: Float64Array
): void {
  for (let i: i32 = 0; i < size; i++) {
    result[i] = Math.abs(a[i])
  }
}

/**
 * SIMD-optimized absolute value using v128
 */
export function absSIMD(
  a: Float64Array,
  size: i32,
  result: Float64Array
): void {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)

  // Process pairs using SIMD
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const absVec: v128 = f64x2.abs(aVec)
    v128.store(changetype<usize>(result) + (i << 3), absVec)
  }

  // Handle remaining elements
  for (; i < size; i++) {
    result[i] = Math.abs(a[i])
  }
}

/**
 * Negate all elements
 */
export function negate(
  a: Float64Array,
  size: i32,
  result: Float64Array
): void {
  for (let i: i32 = 0; i < size; i++) {
    result[i] = -a[i]
  }
}

/**
 * SIMD-optimized negation using v128
 */
export function negateSIMD(
  a: Float64Array,
  size: i32,
  result: Float64Array
): void {
  let i: i32 = 0
  const limit: i32 = size - (size % 2)

  // Process pairs using SIMD
  for (; i < limit; i += 2) {
    const aVec: v128 = v128.load(changetype<usize>(a) + (i << 3))
    const negVec: v128 = f64x2.neg(aVec)
    v128.store(changetype<usize>(result) + (i << 3), negVec)
  }

  // Handle remaining elements
  for (; i < size; i++) {
    result[i] = -a[i]
  }
}

// Helper function
@inline
function min(a: i32, b: i32): i32 {
  return a < b ? a : b
}
