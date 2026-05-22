/**
 * MathTS Compute Worker
 *
 * Worker implementation for parallel MathTS operations.
 * This file is loaded by the worker pool and provides computation functions.
 *
 * @packageDocumentation
 */

import { worker } from 'workerpool';

/**
 * Sum a chunk of data
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
 * Element-wise operation on two chunks
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
 * Transpose a chunk of matrix rows
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
 * Compute variance for a chunk using Welford's algorithm
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
 * Dot product for a chunk
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
 * Distance calculation for a chunk
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
 * Map function over a chunk
 * Note: fn is passed as a string and eval'd in the worker context
 */
function mapChunk<T, R>(chunk: T[], fnString: string): R[] {
  // eslint-disable-next-line no-eval
  const fn = eval(`(${fnString})`) as (item: T) => R;
  return chunk.map(fn);
}

/**
 * Scale a chunk by a scalar
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
 * Bitwise element-wise op on two Int32Array chunks. The result buffer
 * is returned as a fresh `ArrayBuffer` so the worker can transfer it
 * back zero-copy.
 *
 * Op codes match the binary ops exposed by `parallel/src/ops/bitwise.ts`:
 * `'bitAnd' | 'bitOr' | 'bitXor' | 'leftShift' | 'rightArithShift' |
 * 'rightLogShift'`.
 */
function bitwiseBinaryChunk(
  aBuffer: ArrayBuffer,
  bBuffer: ArrayBuffer,
  start: number,
  length: number,
  op:
    | 'bitAnd'
    | 'bitOr'
    | 'bitXor'
    | 'leftShift'
    | 'rightArithShift'
    | 'rightLogShift'
): ArrayBuffer {
  const a = new Int32Array(aBuffer);
  const b = new Int32Array(bBuffer);
  const result = new Int32Array(length);

  for (let i = 0; i < length; i++) {
    const ai = a[start + i];
    const bi = b[start + i];
    switch (op) {
      case 'bitAnd':
        result[i] = ai & bi;
        break;
      case 'bitOr':
        result[i] = ai | bi;
        break;
      case 'bitXor':
        result[i] = ai ^ bi;
        break;
      case 'leftShift':
        result[i] = ai << bi;
        break;
      case 'rightArithShift':
        result[i] = ai >> bi;
        break;
      case 'rightLogShift':
        result[i] = ai >>> bi;
        break;
    }
  }

  return result.buffer;
}

/**
 * Unary bitwise NOT over an `Int32Array` chunk. Returns a fresh
 * `ArrayBuffer` for zero-copy transfer.
 */
function bitwiseNotChunk(
  buffer: ArrayBuffer,
  start: number,
  length: number
): ArrayBuffer {
  const data = new Int32Array(buffer);
  const result = new Int32Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = ~data[start + i];
  }
  return result.buffer;
}

/**
 * Find min/max in a chunk
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

// Register all worker functions
// Type assertion needed as workerpool expects generic function signatures
worker({
  sumChunk,
  elementwiseChunk,
  matmulRows,
  transposeRows,
  varianceChunk,
  dotChunk,
  distanceChunk,
  mapChunk,
  scaleChunk,
  minMaxChunk,
  bitwiseBinaryChunk,
  bitwiseNotChunk,
} as Record<string, (...args: unknown[]) => unknown>);
