/**
 * WASM-optimized statistics operations using raw memory pointers
 *
 * These functions provide WASM-accelerated implementations of statistical
 * calculations for arrays and matrices.
 *
 * All functions use raw memory pointers (usize) for array parameters to ensure
 * proper interop with JavaScript/TypeScript callers via WasmLoader.
 *
 * Performance: 3-6x faster than JavaScript for large datasets
 */

// Size of f64 in bytes
const F64_SIZE: usize = 8

/**
 * Calculate mean (average) of an array
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Mean value
 */
export function mean(dataPtr: usize, length: i32): f64 {
  if (length === 0) return 0

  let sum: f64 = 0
  for (let i: i32 = 0; i < length; i++) {
    sum += load<f64>(dataPtr + (<usize>i << 3))
  }
  return sum / f64(length)
}

/**
 * Calculate median of a sorted array
 * Note: Array must be pre-sorted
 * @param dataPtr Pointer to Float64Array data (must be sorted)
 * @param length Length of array
 * @returns Median value
 */
export function median(dataPtr: usize, length: i32): f64 {
  if (length === 0) return 0
  if (length === 1) return load<f64>(dataPtr)

  const mid = length >> 1
  if (length & 1) {
    // Odd length
    return load<f64>(dataPtr + (<usize>mid << 3))
  } else {
    // Even length
    return (load<f64>(dataPtr + (<usize>(mid - 1) << 3)) + load<f64>(dataPtr + (<usize>mid << 3))) / 2.0
  }
}

/**
 * Calculate variance of an array
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @param ddof Delta degrees of freedom (0 for biased, 1 for unbiased)
 * @returns Variance
 */
export function variance(dataPtr: usize, length: i32, ddof: i32): f64 {
  if (length === 0) return 0
  if (length <= ddof) return NaN

  const m = mean(dataPtr, length)
  let sumSquares: f64 = 0

  for (let i: i32 = 0; i < length; i++) {
    const diff = load<f64>(dataPtr + (<usize>i << 3)) - m
    sumSquares += diff * diff
  }

  return sumSquares / f64(length - ddof)
}

/**
 * Calculate standard deviation
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @param ddof Delta degrees of freedom (0 for biased, 1 for unbiased)
 * @returns Standard deviation
 */
export function std(dataPtr: usize, length: i32, ddof: i32): f64 {
  return Math.sqrt(variance(dataPtr, length, ddof))
}

/**
 * Calculate sum of array
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Sum of all elements
 */
export function sum(dataPtr: usize, length: i32): f64 {
  let total: f64 = 0
  for (let i: i32 = 0; i < length; i++) {
    total += load<f64>(dataPtr + (<usize>i << 3))
  }
  return total
}

/**
 * Calculate product of array
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Product of all elements
 */
export function prod(dataPtr: usize, length: i32): f64 {
  let product: f64 = 1
  for (let i: i32 = 0; i < length; i++) {
    product *= load<f64>(dataPtr + (<usize>i << 3))
  }
  return product
}

/**
 * Find minimum value in array
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Minimum value
 */
export function min(dataPtr: usize, length: i32): f64 {
  if (length === 0) return NaN

  let minVal = load<f64>(dataPtr)
  for (let i: i32 = 1; i < length; i++) {
    const val = load<f64>(dataPtr + (<usize>i << 3))
    if (val < minVal) minVal = val
  }
  return minVal
}

/**
 * Find maximum value in array
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Maximum value
 */
export function max(dataPtr: usize, length: i32): f64 {
  if (length === 0) return NaN

  let maxVal = load<f64>(dataPtr)
  for (let i: i32 = 1; i < length; i++) {
    const val = load<f64>(dataPtr + (<usize>i << 3))
    if (val > maxVal) maxVal = val
  }
  return maxVal
}

/**
 * Calculate cumulative sum (in-place)
 * @param dataPtr Pointer to Float64Array data (modified in-place)
 * @param length Length of array
 */
export function cumsum(dataPtr: usize, length: i32): void {
  if (length === 0) return

  for (let i: i32 = 1; i < length; i++) {
    const prev = load<f64>(dataPtr + (<usize>(i - 1) << 3))
    const curr = load<f64>(dataPtr + (<usize>i << 3))
    store<f64>(dataPtr + (<usize>i << 3), prev + curr)
  }
}

/**
 * Quicksort for raw f64 array (in-place)
 * @param dataPtr Pointer to Float64Array data
 * @param left Left index
 * @param right Right index
 */
function quicksortRaw(dataPtr: usize, left: i32, right: i32): void {
  if (left >= right) return

  const pivotIndex = partitionRaw(dataPtr, left, right)
  quicksortRaw(dataPtr, left, pivotIndex - 1)
  quicksortRaw(dataPtr, pivotIndex + 1, right)
}

/**
 * Partition helper for quicksort
 */
function partitionRaw(dataPtr: usize, left: i32, right: i32): i32 {
  const pivot = load<f64>(dataPtr + (<usize>right << 3))
  let i = left - 1

  for (let j: i32 = left; j < right; j++) {
    if (load<f64>(dataPtr + (<usize>j << 3)) <= pivot) {
      i++
      // Swap
      const temp = load<f64>(dataPtr + (<usize>i << 3))
      store<f64>(dataPtr + (<usize>i << 3), load<f64>(dataPtr + (<usize>j << 3)))
      store<f64>(dataPtr + (<usize>j << 3), temp)
    }
  }

  // Swap pivot
  const temp = load<f64>(dataPtr + (<usize>(i + 1) << 3))
  store<f64>(dataPtr + (<usize>(i + 1) << 3), load<f64>(dataPtr + (<usize>right << 3)))
  store<f64>(dataPtr + (<usize>right << 3), temp)

  return i + 1
}

/**
 * Calculate median absolute deviation (MAD)
 * MAD = median(|x - median(x)|)
 * @param dataPtr Pointer to Float64Array data (will be modified - sorted)
 * @param length Length of array
 * @param workPtr Pointer to work buffer (must be same size as data)
 * @returns MAD value
 */
export function mad(dataPtr: usize, length: i32, workPtr: usize): f64 {
  if (length === 0) return 0

  // Copy data to work buffer for sorting
  for (let i: i32 = 0; i < length; i++) {
    store<f64>(workPtr + (<usize>i << 3), load<f64>(dataPtr + (<usize>i << 3)))
  }

  // Sort work buffer and get median
  quicksortRaw(workPtr, 0, length - 1)
  const med = median(workPtr, length)

  // Calculate absolute deviations in work buffer
  for (let i: i32 = 0; i < length; i++) {
    const val = load<f64>(dataPtr + (<usize>i << 3))
    store<f64>(workPtr + (<usize>i << 3), Math.abs(val - med))
  }

  // Sort deviations and find median
  quicksortRaw(workPtr, 0, length - 1)
  return median(workPtr, length)
}

/**
 * Calculate quantile (percentile)
 * Note: Array must be pre-sorted
 * @param dataPtr Pointer to Float64Array data (must be sorted)
 * @param length Length of array
 * @param p Probability (0 to 1)
 * @returns Quantile value
 */
export function quantile(dataPtr: usize, length: i32, p: f64): f64 {
  if (length === 0) return NaN
  if (p < 0 || p > 1) return NaN

  const index = p * f64(length - 1)
  const lower = i32(Math.floor(index))
  const upper = i32(Math.ceil(index))

  if (lower === upper) {
    return load<f64>(dataPtr + (<usize>lower << 3))
  }

  const fraction = index - f64(lower)
  return load<f64>(dataPtr + (<usize>lower << 3)) * (1 - fraction) + load<f64>(dataPtr + (<usize>upper << 3)) * fraction
}

/**
 * Calculate covariance between two arrays
 * @param xPtr Pointer to first Float64Array
 * @param yPtr Pointer to second Float64Array
 * @param length Length of arrays
 * @param ddof Delta degrees of freedom
 * @returns Covariance
 */
export function covariance(xPtr: usize, yPtr: usize, length: i32, ddof: i32): f64 {
  if (length === 0) return NaN
  if (length <= ddof) return NaN

  const meanX = mean(xPtr, length)
  const meanY = mean(yPtr, length)

  let sumProd: f64 = 0
  for (let i: i32 = 0; i < length; i++) {
    sumProd += (load<f64>(xPtr + (<usize>i << 3)) - meanX) * (load<f64>(yPtr + (<usize>i << 3)) - meanY)
  }

  return sumProd / f64(length - ddof)
}

/**
 * Calculate Pearson correlation coefficient
 * @param xPtr Pointer to first Float64Array
 * @param yPtr Pointer to second Float64Array
 * @param length Length of arrays
 * @returns Correlation coefficient (-1 to 1)
 */
export function correlation(xPtr: usize, yPtr: usize, length: i32): f64 {
  if (length === 0) return NaN

  const meanX = mean(xPtr, length)
  const meanY = mean(yPtr, length)

  let sumXY: f64 = 0
  let sumX2: f64 = 0
  let sumY2: f64 = 0

  for (let i: i32 = 0; i < length; i++) {
    const dx = load<f64>(xPtr + (<usize>i << 3)) - meanX
    const dy = load<f64>(yPtr + (<usize>i << 3)) - meanY
    sumXY += dx * dy
    sumX2 += dx * dx
    sumY2 += dy * dy
  }

  const denom = Math.sqrt(sumX2 * sumY2)
  if (denom === 0) return NaN
  return sumXY / denom
}

/**
 * Calculate range (max - min)
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Range
 */
export function range(dataPtr: usize, length: i32): f64 {
  return max(dataPtr, length) - min(dataPtr, length)
}

/**
 * Calculate geometric mean
 * @param dataPtr Pointer to Float64Array data (all values must be positive)
 * @param length Length of array
 * @returns Geometric mean
 */
export function geometricMean(dataPtr: usize, length: i32): f64 {
  if (length === 0) return NaN

  let logSum: f64 = 0
  for (let i: i32 = 0; i < length; i++) {
    const val = load<f64>(dataPtr + (<usize>i << 3))
    if (val <= 0) return NaN
    logSum += Math.log(val)
  }
  return Math.exp(logSum / f64(length))
}

/**
 * Calculate harmonic mean
 * @param dataPtr Pointer to Float64Array data (all values must be positive)
 * @param length Length of array
 * @returns Harmonic mean
 */
export function harmonicMean(dataPtr: usize, length: i32): f64 {
  if (length === 0) return NaN

  let recipSum: f64 = 0
  for (let i: i32 = 0; i < length; i++) {
    const val = load<f64>(dataPtr + (<usize>i << 3))
    if (val === 0) return 0
    recipSum += 1.0 / val
  }
  return f64(length) / recipSum
}

/**
 * Calculate skewness
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Skewness
 */
export function skewness(dataPtr: usize, length: i32): f64 {
  if (length < 3) return NaN

  const m = mean(dataPtr, length)
  const s = std(dataPtr, length, 1)
  if (s === 0) return NaN

  let sum3: f64 = 0
  for (let i: i32 = 0; i < length; i++) {
    const diff = (load<f64>(dataPtr + (<usize>i << 3)) - m) / s
    sum3 += diff * diff * diff
  }

  const n = f64(length)
  return (n / ((n - 1) * (n - 2))) * sum3
}

/**
 * Calculate kurtosis (excess kurtosis)
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Excess kurtosis
 */
export function kurtosis(dataPtr: usize, length: i32): f64 {
  if (length < 4) return NaN

  const m = mean(dataPtr, length)
  const s = std(dataPtr, length, 1)
  if (s === 0) return NaN

  let sum4: f64 = 0
  for (let i: i32 = 0; i < length; i++) {
    const diff = (load<f64>(dataPtr + (<usize>i << 3)) - m) / s
    const d2 = diff * diff
    sum4 += d2 * d2
  }

  const n = f64(length)
  const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))
  const term2 = (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3))
  return term1 * sum4 - term2
}

/**
 * Calculate interquartile range (IQR = Q3 - Q1)
 * @param dataPtr Pointer to Float64Array data (will be sorted)
 * @param length Length of array
 * @returns IQR value
 */
export function interquartileRange(dataPtr: usize, length: i32): f64 {
  if (length === 0) return NaN

  quicksortRaw(dataPtr, 0, length - 1)
  const q1 = quantile(dataPtr, length, 0.25)
  const q3 = quantile(dataPtr, length, 0.75)
  return q3 - q1
}

/**
 * Calculate z-scores (standardized values)
 * @param dataPtr Pointer to input Float64Array
 * @param resultPtr Pointer to output Float64Array
 * @param length Length of arrays
 */
export function zscore(dataPtr: usize, resultPtr: usize, length: i32): void {
  if (length === 0) return

  const m = mean(dataPtr, length)
  const s = std(dataPtr, length, 1)

  if (s === 0) {
    // All values are the same
    for (let i: i32 = 0; i < length; i++) {
      store<f64>(resultPtr + (<usize>i << 3), 0)
    }
    return
  }

  for (let i: i32 = 0; i < length; i++) {
    store<f64>(resultPtr + (<usize>i << 3), (load<f64>(dataPtr + (<usize>i << 3)) - m) / s)
  }
}

/**
 * Calculate percentile (same as quantile but takes 0-100 instead of 0-1)
 * @param dataPtr Pointer to Float64Array data (must be sorted)
 * @param length Length of array
 * @param p Percentile (0 to 100)
 * @returns Percentile value
 */
export function percentile(dataPtr: usize, length: i32, p: f64): f64 {
  return quantile(dataPtr, length, p / 100.0)
}

/**
 * Calculate median without requiring pre-sorted data
 * @param dataPtr Pointer to Float64Array data (will be sorted)
 * @param length Length of array
 * @returns Median value
 */
export function medianUnsorted(dataPtr: usize, length: i32): f64 {
  if (length === 0) return NaN
  quicksortRaw(dataPtr, 0, length - 1)
  return median(dataPtr, length)
}

/**
 * Calculate root mean square (RMS)
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns RMS value
 */
export function rms(dataPtr: usize, length: i32): f64 {
  if (length === 0) return NaN

  let sumSquares: f64 = 0
  for (let i: i32 = 0; i < length; i++) {
    const val = load<f64>(dataPtr + (<usize>i << 3))
    sumSquares += val * val
  }
  return Math.sqrt(sumSquares / f64(length))
}

/**
 * Calculate coefficient of variation (CV = std/mean)
 * @param dataPtr Pointer to Float64Array data
 * @param length Length of array
 * @returns Coefficient of variation
 */
export function coefficientOfVariation(dataPtr: usize, length: i32): f64 {
  const m = mean(dataPtr, length)
  if (m === 0) return NaN
  return std(dataPtr, length, 1) / Math.abs(m)
}

/**
 * Calculate simple moving average of an array
 * @param dataPtr Pointer to input Float64Array data
 * @param length Length of input array
 * @param window Window size (must be >= 1 and <= length)
 * @param resultPtr Pointer to output Float64Array (must hold length - window + 1 elements)
 * @returns Number of elements written to resultPtr, or -1 on error
 */
export function movingAverage(dataPtr: usize, length: i32, window: i32, resultPtr: usize): i32 {
  if (window < 1) return -1
  if (window > length) return -1

  const resultLength: i32 = length - window + 1

  // Compute initial window sum
  let windowSum: f64 = 0
  for (let i: i32 = 0; i < window; i++) {
    windowSum += load<f64>(dataPtr + (<usize>i << 3))
  }
  store<f64>(resultPtr, windowSum / f64(window))

  // Slide the window
  for (let i: i32 = window; i < length; i++) {
    windowSum += load<f64>(dataPtr + (<usize>i << 3)) - load<f64>(dataPtr + (<usize>(i - window) << 3))
    store<f64>(resultPtr + (<usize>(i - window + 1) << 3), windowSum / f64(window))
  }

  return resultLength
}
/**
 * Compute histogram counts given data and pre-computed bin edges
 * Internal helper: bins data into [edge[i], edge[i+1]) intervals,
 * with the last bin being [edge[n-1], edge[n]].
 * @param dataPtr Pointer to Float64Array of data values
 * @param dataLen Length of data array
 * @param edgesPtr Pointer to Float64Array of bin edges (length = numBins + 1)
 * @param numBins Number of bins (edgesPtr has numBins + 1 elements)
 * @param countsPtr Pointer to output i32 array of length numBins (zeroed by caller)
 */
function histogramComputeCounts(
  dataPtr: usize,
  dataLen: i32,
  edgesPtr: usize,
  numBins: i32,
  countsPtr: usize
): void {
  const lastEdge = load<f64>(edgesPtr + (<usize>numBins << 3))
  const firstEdge = load<f64>(edgesPtr)

  for (let j: i32 = 0; j < dataLen; j++) {
    const val = load<f64>(dataPtr + (<usize>j << 3))

    if (val < firstEdge || val > lastEdge) {
      continue
    }

    if (val === lastEdge) {
      // Include max value in last bin
      const idx = numBins - 1
      store<i32>(countsPtr + (<usize>idx << 2), load<i32>(countsPtr + (<usize>idx << 2)) + 1)
      continue
    }

    // Binary search for bin index
    let lo: i32 = 0
    let hi: i32 = numBins - 1
    while (lo < hi) {
      const mid: i32 = (lo + hi) >> 1
      if (val < load<f64>(edgesPtr + (<usize>(mid + 1) << 3))) {
        hi = mid
      } else {
        lo = mid + 1
      }
    }
    store<i32>(countsPtr + (<usize>lo << 2), load<i32>(countsPtr + (<usize>lo << 2)) + 1)
  }
}

/**
 * Compute histogram with a specified number of equal-width bins.
 * Bin edges are written to edgesPtr (numBins + 1 values).
 * Bin centers are written to centersPtr (numBins values).
 * Counts are written to countsPtr (numBins i32 values).
 *
 * @param dataPtr Pointer to Float64Array of data values
 * @param dataLen Length of data array (must be > 0)
 * @param numBins Number of equal-width bins (must be >= 1)
 * @param edgesPtr Pointer to output Float64Array for bin edges (size: numBins + 1)
 * @param centersPtr Pointer to output Float64Array for bin centers (size: numBins)
 * @param countsPtr Pointer to output i32 array for counts (size: numBins, must be zeroed)
 * @returns 0 on success, -1 if dataLen == 0, -2 if numBins < 1
 */
export function histogramNumBins(
  dataPtr: usize,
  dataLen: i32,
  numBins: i32,
  edgesPtr: usize,
  centersPtr: usize,
  countsPtr: usize
): i32 {
  if (dataLen === 0) return -1
  if (numBins < 1) return -2

  // Find min and max
  let minVal = load<f64>(dataPtr)
  let maxVal = load<f64>(dataPtr)
  for (let i: i32 = 1; i < dataLen; i++) {
    const v = load<f64>(dataPtr + (<usize>i << 3))
    if (v < minVal) minVal = v
    if (v > maxVal) maxVal = v
  }

  const rng = maxVal - minVal
  const step: f64 = rng === 0.0 ? 1.0 : rng / f64(numBins)

  // Write bin edges
  for (let i: i32 = 0; i <= numBins; i++) {
    store<f64>(edgesPtr + (<usize>i << 3), minVal + f64(i) * step)
  }
  // Last edge: if range == 0, maxVal + 1; else exactly maxVal
  if (rng === 0.0) {
    store<f64>(edgesPtr + (<usize>numBins << 3), maxVal + 1.0)
  } else {
    store<f64>(edgesPtr + (<usize>numBins << 3), maxVal)
  }

  // Write bin centers
  for (let i: i32 = 0; i < numBins; i++) {
    const lo = load<f64>(edgesPtr + (<usize>i << 3))
    const hi = load<f64>(edgesPtr + (<usize>(i + 1) << 3))
    store<f64>(centersPtr + (<usize>i << 3), (lo + hi) / 2.0)
  }

  // Compute counts
  histogramComputeCounts(dataPtr, dataLen, edgesPtr, numBins, countsPtr)

  return 0
}

/**
 * Compute histogram with explicit bin edges provided by caller.
 * Bin centers are written to centersPtr (numBins values).
 * Counts are written to countsPtr (numBins i32 values).
 *
 * @param dataPtr Pointer to Float64Array of data values
 * @param dataLen Length of data array
 * @param edgesPtr Pointer to Float64Array of bin edges (strictly increasing, length = numBins + 1)
 * @param numBins Number of bins (edgesPtr has numBins + 1 elements; must be >= 1)
 * @param centersPtr Pointer to output Float64Array for bin centers (size: numBins)
 * @param countsPtr Pointer to output i32 array for counts (size: numBins, must be zeroed)
 * @returns 0 on success, -3 if numBins < 1, -4 if edges are not strictly increasing
 */
export function histogramEdges(
  dataPtr: usize,
  dataLen: i32,
  edgesPtr: usize,
  numBins: i32,
  centersPtr: usize,
  countsPtr: usize
): i32 {
  if (numBins < 1) return -3

  // Validate strictly increasing edges
  for (let i: i32 = 1; i <= numBins; i++) {
    const prev = load<f64>(edgesPtr + (<usize>(i - 1) << 3))
    const curr = load<f64>(edgesPtr + (<usize>i << 3))
    if (curr <= prev) return -4
  }

  // Write bin centers
  for (let i: i32 = 0; i < numBins; i++) {
    const lo = load<f64>(edgesPtr + (<usize>i << 3))
    const hi = load<f64>(edgesPtr + (<usize>(i + 1) << 3))
    store<f64>(centersPtr + (<usize>i << 3), (lo + hi) / 2.0)
  }

  // Compute counts
  histogramComputeCounts(dataPtr, dataLen, edgesPtr, numBins, countsPtr)

  return 0
}
/**
 * Perform simple linear regression on two datasets (ordinary least squares).
 * Fits the model: y = slope * x + intercept
 *
 * Results are written to resultPtr as [slope, intercept, r, r2] (4 x f64 values).
 *
 * @param xPtr Pointer to Float64Array of independent variable (predictor)
 * @param yPtr Pointer to Float64Array of dependent variable (response)
 * @param length Length of both arrays (must be >= 2 and equal)
 * @param resultPtr Pointer to output Float64Array of length 4: [slope, intercept, r, r2]
 * @returns 0 on success, -1 if length < 2, -2 if all x values are identical
 */
export function linreg(xPtr: usize, yPtr: usize, length: i32, resultPtr: usize): i32 {
  if (length < 2) return -1

  let sumX: f64 = 0
  let sumY: f64 = 0
  let sumXY: f64 = 0
  let sumX2: f64 = 0
  let sumY2: f64 = 0

  for (let i: i32 = 0; i < length; i++) {
    const xi = load<f64>(xPtr + (<usize>i << 3))
    const yi = load<f64>(yPtr + (<usize>i << 3))
    sumX += xi
    sumY += yi
    sumXY += xi * yi
    sumX2 += xi * xi
    sumY2 += yi * yi
  }

  const n = f64(length)
  const meanX = sumX / n
  const meanY = sumY / n

  const ssXX = sumX2 - n * meanX * meanX
  const ssYY = sumY2 - n * meanY * meanY
  const ssXY = sumXY - n * meanX * meanY

  if (ssXX === 0) return -2

  const slope = ssXY / ssXX
  const intercept = meanY - slope * meanX

  let r: f64 = 0
  if (ssXX !== 0 && ssYY !== 0) {
    r = ssXY / Math.sqrt(ssXX * ssYY)
  }
  const r2 = r * r

  store<f64>(resultPtr + (<usize>0 << 3), slope)
  store<f64>(resultPtr + (<usize>1 << 3), intercept)
  store<f64>(resultPtr + (<usize>2 << 3), r)
  store<f64>(resultPtr + (<usize>3 << 3), r2)

  return 0
}

/**
 * Predict y value from a fitted linear regression model.
 * Uses slope and intercept previously computed by linreg.
 *
 * @param slope Regression slope
 * @param intercept Regression intercept
 * @param xVal Input x value to predict
 * @returns Predicted y value: slope * xVal + intercept
 */
export function linregPredict(slope: f64, intercept: f64, xVal: f64): f64 {
  return slope * xVal + intercept
}