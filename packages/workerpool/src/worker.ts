/**
 * @danielsimonjr/mathts-workerpool Worker Implementation
 *
 * Worker functions for parallel MathTS computations.
 * This file is loaded by worker threads and provides computation functions.
 *
 * @packageDocumentation
 */

import { worker } from 'workerpool';
import { fftFrameInPlace } from './fft-core.js';

// =============================================================================
// Array Reduction Operations
// =============================================================================

/**
 * Sum elements in a chunk of Float64Array
 */
function sumChunk(buffer: ArrayBuffer, start: number, length: number): number {
  const data = new Float64Array(buffer);
  let total = 0;
  const end = start + length;
  for (let i = start; i < end; i++) {
    total += data[i];
  }
  return total;
}

/**
 * Compute product of elements in a chunk of Float64Array
 */
function prodChunk(buffer: ArrayBuffer, start: number, length: number): number {
  const data = new Float64Array(buffer);
  let total = 1;
  const end = start + length;
  for (let i = start; i < end; i++) {
    total *= data[i];
  }
  return total;
}

/**
 * Compute dot product for a chunk
 */
function dotChunk(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  start: number,
  length: number
): number {
  const a = new Float64Array(aBuffer);
  const b = new Float64Array(bBuffer);
  let result = 0;
  const end = start + length;

  for (let i = start; i < end; i++) {
    result += a[i] * b[i];
  }

  return result;
}

/**
 * Compute variance statistics using Welford's algorithm
 */
function varianceChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number
): { count: number; mean: number; m2: number } {
  const data = new Float64Array(buffer);
  let mean = 0;
  let m2 = 0;

  for (let i = 0; i < length; i++) {
    const x = data[start + i];
    const n = i + 1;
    const delta = x - mean;
    mean += delta / n;
    const delta2 = x - mean;
    m2 += delta * delta2;
  }

  return { count: length, mean, m2 };
}

/**
 * Find min/max values in a chunk
 */
function minMaxChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number
): { min: number; max: number; minIdx: number; maxIdx: number } {
  const data = new Float64Array(buffer);
  let min = data[start];
  let max = data[start];
  let minIdx = start;
  let maxIdx = start;

  const end = start + length;
  for (let i = start + 1; i < end; i++) {
    if (data[i] < min) {
      min = data[i];
      minIdx = i;
    }
    if (data[i] > max) {
      max = data[i];
      maxIdx = i;
    }
  }

  return { min, max, minIdx, maxIdx };
}

/**
 * Compute norm (sum of squares) for a chunk
 */
function normChunk(buffer: ArrayBuffer, start: number, length: number): number {
  const data = new Float64Array(buffer);
  let sumSq = 0;
  const end = start + length;

  for (let i = start; i < end; i++) {
    sumSq += data[i] * data[i];
  }

  return sumSq;
}

// =============================================================================
// Element-wise Operations
// =============================================================================

/**
 * Element-wise binary operation on two chunks
 */
function elementwiseChunk(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  start: number,
  length: number,
  op: 'add' | 'subtract' | 'multiply' | 'divide'
): ArrayBuffer {
  const a = new Float64Array(aBuffer);
  const b = new Float64Array(bBuffer);
  const result = new Float64Array(length);

  for (let i = 0; i < length; i++) {
    const ai = a[start + i];
    const bi = b[start + i];
    switch (op) {
      case 'add':
        result[i] = ai + bi;
        break;
      case 'subtract':
        result[i] = ai - bi;
        break;
      case 'multiply':
        result[i] = ai * bi;
        break;
      case 'divide':
        result[i] = ai / bi;
        break;
    }
  }

  return result.buffer;
}

/**
 * Scale a chunk by a scalar value
 */
function scaleChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number,
  scalar: number
): ArrayBuffer {
  const data = new Float64Array(buffer);
  const result = new Float64Array(length);

  for (let i = 0; i < length; i++) {
    result[i] = data[start + i] * scalar;
  }

  return result.buffer;
}

/**
 * Apply a unary function to a chunk
 */
function unaryChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number,
  fnName: 'abs' | 'sqrt' | 'exp' | 'log' | 'sin' | 'cos' | 'tan' | 'negate' | 'square'
): ArrayBuffer {
  const data = new Float64Array(buffer);
  const result = new Float64Array(length);

  for (let i = 0; i < length; i++) {
    const val = data[start + i];
    switch (fnName) {
      case 'abs':
        result[i] = Math.abs(val);
        break;
      case 'sqrt':
        result[i] = Math.sqrt(val);
        break;
      case 'exp':
        result[i] = Math.exp(val);
        break;
      case 'log':
        result[i] = Math.log(val);
        break;
      case 'sin':
        result[i] = Math.sin(val);
        break;
      case 'cos':
        result[i] = Math.cos(val);
        break;
      case 'tan':
        result[i] = Math.tan(val);
        break;
      case 'negate':
        result[i] = -val;
        break;
      case 'square':
        result[i] = val * val;
        break;
    }
  }

  return result.buffer;
}

/**
 * Apply a caller-supplied unary numeric function to a chunk.
 *
 * `fnSource` is the source of a self-contained `(x: number) => number`
 * expression, eval'd in the worker. Used to parallelize element-wise math
 * (special functions, distribution PDFs/CDFs) that the worker cannot import
 * directly because it sits below those packages in the dependency graph.
 */
function applyKernelChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number,
  fnSource: string
): ArrayBuffer {
  const data = new Float64Array(buffer);
  const result = new Float64Array(length);
  // eslint-disable-next-line no-eval
  const fn = eval(`(${fnSource})`) as (x: number) => number;
  for (let i = 0; i < length; i++) {
    result[i] = fn(data[start + i]);
  }
  return result.buffer;
}

/**
 * Apply a caller-supplied binary numeric function to a pair of chunks.
 *
 * `fnSource` is the source of a self-contained `(a: number, b: number) =>
 * number` expression, eval'd in the worker.
 */
function applyKernel2Chunk(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  start: number,
  length: number,
  fnSource: string
): ArrayBuffer {
  const a = new Float64Array(aBuffer);
  const b = new Float64Array(bBuffer);
  const result = new Float64Array(length);
  // eslint-disable-next-line no-eval
  const fn = eval(`(${fnSource})`) as (a: number, b: number) => number;
  for (let i = 0; i < length; i++) {
    result[i] = fn(a[start + i], b[start + i]);
  }
  return result.buffer;
}

// =============================================================================
// Bitwise Operations (Int32Array)
// =============================================================================

/**
 * Binary bitwise op code shared by the worker-side kernel and the
 * `parallel/src/ops/bitwise.ts` in-process driver.
 */
type BitwiseBinaryOpCode =
  | 'bitAnd'
  | 'bitOr'
  | 'bitXor'
  | 'leftShift'
  | 'rightArithShift'
  | 'rightLogShift';

/**
 * Element-wise bitwise binary op on two `Int32Array`-backed chunks.
 *
 * Mirrors the `elementwiseChunk` shape: takes both operand buffers, the
 * shared start offset (always 0 from `MathWorkerPool` since each chunk owns
 * its own buffer — see `chunkInt32Array`), a length, and the op code.
 *
 * The pure semantics live in `parallel/src/ops/bitwise.ts` (`applyBinaryChunk`),
 * but that file isn't reachable from this worker (workerpool sits below
 * parallel in the dep graph). The op switch is inlined here verbatim so the
 * worker has zero non-worker imports.
 */
function bitwiseChunk(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  start: number,
  length: number,
  op: BitwiseBinaryOpCode
): ArrayBuffer {
  const a = new Int32Array(aBuffer);
  const b = new Int32Array(bBuffer);
  const result = new Int32Array(length);

  switch (op) {
    case 'bitAnd':
      for (let i = 0; i < length; i++) result[i] = a[start + i] & b[start + i];
      break;
    case 'bitOr':
      for (let i = 0; i < length; i++) result[i] = a[start + i] | b[start + i];
      break;
    case 'bitXor':
      for (let i = 0; i < length; i++) result[i] = a[start + i] ^ b[start + i];
      break;
    case 'leftShift':
      for (let i = 0; i < length; i++) result[i] = a[start + i] << b[start + i];
      break;
    case 'rightArithShift':
      for (let i = 0; i < length; i++) result[i] = a[start + i] >> b[start + i];
      break;
    case 'rightLogShift':
      // `>>>` yields a Uint32 — Int32Array assignment wraps it back into the
      // signed range, matching the `(x >>> n) | 0` idiom.
      for (let i = 0; i < length; i++) result[i] = a[start + i] >>> b[start + i];
      break;
  }

  return result.buffer;
}

/**
 * Element-wise bitwise op on an `Int32Array` chunk with a scalar second
 * operand. Used by the `Int32Array, number` shift overloads from
 * `ComputePool.leftShift / rightArithShift / rightLogShift`.
 */
function bitwiseScalarChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number,
  scalar: number,
  op: BitwiseBinaryOpCode
): ArrayBuffer {
  const data = new Int32Array(buffer);
  const result = new Int32Array(length);

  switch (op) {
    case 'bitAnd':
      for (let i = 0; i < length; i++) result[i] = data[start + i] & scalar;
      break;
    case 'bitOr':
      for (let i = 0; i < length; i++) result[i] = data[start + i] | scalar;
      break;
    case 'bitXor':
      for (let i = 0; i < length; i++) result[i] = data[start + i] ^ scalar;
      break;
    case 'leftShift':
      for (let i = 0; i < length; i++) result[i] = data[start + i] << scalar;
      break;
    case 'rightArithShift':
      for (let i = 0; i < length; i++) result[i] = data[start + i] >> scalar;
      break;
    case 'rightLogShift':
      for (let i = 0; i < length; i++) result[i] = data[start + i] >>> scalar;
      break;
  }

  return result.buffer;
}

/**
 * Unary bitwise NOT (`~a[i]`) on an `Int32Array` chunk.
 */
function bitwiseNotChunk(buffer: ArrayBuffer, start: number, length: number): ArrayBuffer {
  const data = new Int32Array(buffer);
  const result = new Int32Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = ~data[start + i];
  }
  return result.buffer;
}

// =============================================================================
// FFT Operations
// =============================================================================

/**
 * Compute a batch of independent radix-2 FFTs.
 *
 * `realBuffer` / `imagBuffer` each hold `frameCount` concatenated frames of
 * `frameLength` Float64 samples (`frameLength` must be a power of two). Each
 * frame is FFT'd independently. The result is returned as a single ArrayBuffer
 * of `2 * frameCount * frameLength` Float64 values: the transformed real parts
 * for all frames followed by the transformed imaginary parts for all frames.
 *
 * This kernel is the worker side of `MathWorkerPool.fftBatch` — it parallelizes
 * the embarrassingly-parallel FFT batches in `spectrogram` and `fft2d`.
 */
function fftBatchChunk(
  realBuffer: ArrayBuffer,
  imagBuffer: ArrayBuffer,
  frameCount: number,
  frameLength: number,
  inverse: boolean
): ArrayBuffer {
  const real = new Float64Array(realBuffer.slice(0));
  const imag = new Float64Array(imagBuffer.slice(0));

  for (let f = 0; f < frameCount; f++) {
    fftFrameInPlace(real, imag, f * frameLength, frameLength, inverse);
  }

  const total = frameCount * frameLength;
  const out = new Float64Array(total * 2);
  out.set(real.subarray(0, total), 0);
  out.set(imag.subarray(0, total), total);
  return out.buffer;
}

// =============================================================================
// Matrix Operations
// =============================================================================

/**
 * Matrix multiplication for a subset of rows
 */
function matmulRows(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  aRows: number,
  aCols: number,
  bCols: number,
  rowStart: number,
  rowEnd: number
): ArrayBuffer {
  const a = new Float64Array(aBuffer);
  const b = new Float64Array(bBuffer);
  const resultRows = rowEnd - rowStart;
  const result = new Float64Array(resultRows * bCols);

  for (let i = 0; i < resultRows; i++) {
    const aRowIdx = rowStart + i;
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[aRowIdx * aCols + k] * b[k * bCols + j];
      }
      result[i * bCols + j] = sum;
    }
  }

  return result.buffer;
}

/**
 * Transpose a subset of matrix rows
 */
function transposeRows(
  buffer: ArrayBuffer,
  rows: number,
  cols: number,
  rowStart: number,
  rowEnd: number
): ArrayBuffer {
  const data = new Float64Array(buffer);
  const resultRows = rowEnd - rowStart;
  const result = new Float64Array(resultRows * cols);

  for (let i = rowStart; i < rowEnd; i++) {
    const localI = i - rowStart;
    for (let j = 0; j < cols; j++) {
      result[j * resultRows + localI] = data[i * cols + j];
    }
  }

  return result.buffer;
}

/**
 * Compute matrix-vector multiplication for a subset of rows
 */
function matvecRows(
  matBuffer: ArrayBuffer,
  vecBuffer: ArrayBuffer,
  rows: number,
  cols: number,
  rowStart: number,
  rowEnd: number
): ArrayBuffer {
  const mat = new Float64Array(matBuffer);
  const vec = new Float64Array(vecBuffer);
  const resultRows = rowEnd - rowStart;
  const result = new Float64Array(resultRows);

  for (let i = 0; i < resultRows; i++) {
    const matRowIdx = rowStart + i;
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += mat[matRowIdx * cols + j] * vec[j];
    }
    result[i] = sum;
  }

  return result.buffer;
}

/**
 * Compute outer product for row chunks
 */
function outerProductRows(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  aLen: number,
  bLen: number,
  rowStart: number,
  rowEnd: number
): ArrayBuffer {
  const a = new Float64Array(aBuffer);
  const b = new Float64Array(bBuffer);
  const resultRows = rowEnd - rowStart;
  const result = new Float64Array(resultRows * bLen);

  for (let i = 0; i < resultRows; i++) {
    const aIdx = rowStart + i;
    for (let j = 0; j < bLen; j++) {
      result[i * bLen + j] = a[aIdx] * b[j];
    }
  }

  return result.buffer;
}

// =============================================================================
// Generic Operations
// =============================================================================

/**
 * Map function over a chunk
 * Note: fn is passed as a string and eval'd in the worker context
 */
function mapChunk<T, R>(chunk: T[], fnString: string): R[] {
  // eslint-disable-next-line no-eval
  const fn = eval(`(${fnString})`) as (item: T) => R;
  return chunk.map(fn);
}

/**
 * Reduce a chunk to a single value
 */
function reduceChunk<T, R>(chunk: T[], fnString: string, initial: R): R {
  // eslint-disable-next-line no-eval
  const fn = eval(`(${fnString})`) as (acc: R, item: T) => R;
  return chunk.reduce(fn, initial);
}

/**
 * Filter a chunk based on predicate
 */
function filterChunk<T>(chunk: T[], predicateString: string): T[] {
  // eslint-disable-next-line no-eval
  const predicate = eval(`(${predicateString})`) as (item: T) => boolean;
  return chunk.filter(predicate);
}

/**
 * Find first element matching predicate
 */
function findChunk<T>(
  chunk: T[],
  predicateString: string,
  chunkOffset: number
): { found: boolean; value?: T; index?: number } {
  // eslint-disable-next-line no-eval
  const predicate = eval(`(${predicateString})`) as (item: T) => boolean;
  const index = chunk.findIndex(predicate);

  if (index === -1) {
    return { found: false };
  }

  return {
    found: true,
    value: chunk[index],
    index: chunkOffset + index,
  };
}

/**
 * Sort a chunk
 */
function sortChunk<T>(chunk: T[], compareString?: string): T[] {
  if (compareString) {
    // eslint-disable-next-line no-eval
    const compare = eval(`(${compareString})`) as (a: T, b: T) => number;
    return [...chunk].sort(compare);
  }
  return [...chunk].sort();
}

// =============================================================================
// Distance/Similarity Operations
// =============================================================================

/**
 * Compute squared Euclidean distance for a chunk
 */
function distanceChunk(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  start: number,
  length: number
): number {
  const a = new Float64Array(aBuffer);
  const b = new Float64Array(bBuffer);
  let sumSquared = 0;
  const end = start + length;

  for (let i = start; i < end; i++) {
    const diff = a[i] - b[i];
    sumSquared += diff * diff;
  }

  return sumSquared;
}

/**
 * Compute cosine similarity components for a chunk
 */
function cosineSimilarityChunk(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  start: number,
  length: number
): { dotProduct: number; normA: number; normB: number } {
  const a = new Float64Array(aBuffer);
  const b = new Float64Array(bBuffer);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const end = start + length;

  for (let i = start; i < end; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return { dotProduct, normA, normB };
}

/**
 * Compute a block of rows of an all-pairs Euclidean distance matrix.
 *
 * `pointsBuffer` is the flattened `n * dim` coordinate array (row-major: point
 * i occupies `[i*dim, i*dim + dim)`). Returns rows `[rowStart, rowEnd)` of the
 * `n x n` distance matrix as a flat `(rowEnd - rowStart) * n` buffer.
 */
function distanceMatrixRowsChunk(
  pointsBuffer: ArrayBuffer,
  n: number,
  dim: number,
  rowStart: number,
  rowEnd: number
): ArrayBuffer {
  const pts = new Float64Array(pointsBuffer);
  const result = new Float64Array((rowEnd - rowStart) * n);

  for (let i = rowStart; i < rowEnd; i++) {
    const iBase = i * dim;
    const outBase = (i - rowStart) * n;
    for (let j = 0; j < n; j++) {
      const jBase = j * dim;
      let sum = 0;
      for (let d = 0; d < dim; d++) {
        const diff = pts[iBase + d] - pts[jBase + d];
        sum += diff * diff;
      }
      result[outBase + j] = Math.sqrt(sum);
    }
  }

  return result.buffer;
}

// =============================================================================
// Statistical Operations
// =============================================================================

/**
 * Compute histogram for a chunk
 */
function histogramChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number,
  min: number,
  max: number,
  bins: number
): number[] {
  const data = new Float64Array(buffer);
  const histogram = new Array(bins).fill(0);
  const binWidth = (max - min) / bins;
  const end = start + length;

  for (let i = start; i < end; i++) {
    const val = data[i];
    if (val >= min && val <= max) {
      const binIdx = Math.min(Math.floor((val - min) / binWidth), bins - 1);
      histogram[binIdx]++;
    }
  }

  return histogram;
}

/**
 * Compute quantile for sorted chunk
 */
function quantileChunk(
  sortedBuffer: ArrayBuffer,
  start: number,
  length: number,
  q: number
): number {
  const data = new Float64Array(sortedBuffer);
  const idx = start + q * (length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;

  if (lower === upper) {
    return data[lower];
  }

  return data[lower] * (1 - weight) + data[upper] * weight;
}

// =============================================================================
// Register Worker Functions
// =============================================================================

// Type assertion needed as workerpool expects generic function signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerMethods: Record<string, (...args: any[]) => any> = {
  // Array reductions
  sumChunk,
  prodChunk,
  dotChunk,
  varianceChunk,
  minMaxChunk,
  normChunk,

  // Element-wise operations
  elementwiseChunk,
  scaleChunk,
  unaryChunk,
  applyKernelChunk,
  applyKernel2Chunk,

  // Bitwise (Int32Array) operations
  bitwiseChunk,
  bitwiseScalarChunk,
  bitwiseNotChunk,

  // FFT operations
  fftBatchChunk,

  // Matrix operations
  matmulRows,
  transposeRows,
  matvecRows,
  outerProductRows,

  // Generic operations
  mapChunk,
  reduceChunk,
  filterChunk,
  findChunk,
  sortChunk,

  // Distance/similarity
  distanceChunk,
  cosineSimilarityChunk,
  distanceMatrixRowsChunk,

  // Statistics
  histogramChunk,
  quantileChunk,
};

worker(workerMethods);
