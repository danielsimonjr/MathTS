/**
 * Parallel Bitwise Operations
 *
 * Element-wise bitwise operations on Int32Array buffers. Operations are
 * applied in a chunked fashion so the work pattern mirrors the other
 * parallel ops (`elementwise`, `scale`, etc.). The actual chunk kernel
 * runs in-process: the MathWorkerPool kernel registry in
 * `@danielsimonjr/mathts-workerpool` is keyed on `Float64Array` buffers,
 * so cross-thread bitwise dispatch is intentionally out of scope here.
 *
 * The chunking still matters: it bounds peak-allocation pressure for
 * very large arrays and keeps the call shape uniform with the rest of
 * the parallel API, so the typed-function `Int32Array, Int32Array`
 * signatures look identical to the `Float64Array, Float64Array` ones.
 *
 * Semantics follow JavaScript bitwise semantics on 32-bit signed
 * integers (two's complement). For shift counts JavaScript itself
 * masks to the low 5 bits — we preserve that behavior.
 *
 * @packageDocumentation
 */

import {
  calculateOptimalChunks,
  type ChunkOptions,
} from '../strategies/chunk.js';

/**
 * The set of supported binary bitwise op codes.
 *
 * - `bitAnd`   : `a & b`
 * - `bitOr`    : `a | b`
 * - `bitXor`   : `a ^ b`
 * - `leftShift`       : `a << b`
 * - `rightArithShift` : `a >> b`  (sign-extending)
 * - `rightLogShift`   : `a >>> b` (zero-filling, returned as Int32 — values
 *   above 2^31 wrap into negative range, as in `(x >>> n) | 0`)
 */
export type BitwiseBinaryOp =
  | 'bitAnd'
  | 'bitOr'
  | 'bitXor'
  | 'leftShift'
  | 'rightArithShift'
  | 'rightLogShift';

/**
 * Apply a binary bitwise op to one chunk of two parallel `Int32Array`
 * inputs. Writes into `out` starting at offset `outStart`.
 */
function applyBinaryChunk(
  a: Int32Array,
  b: Int32Array,
  out: Int32Array,
  start: number,
  length: number,
  outStart: number,
  op: BitwiseBinaryOp
): void {
  const end = start + length;
  switch (op) {
    case 'bitAnd':
      for (let i = start; i < end; i++) out[outStart + (i - start)] = a[i] & b[i];
      return;
    case 'bitOr':
      for (let i = start; i < end; i++) out[outStart + (i - start)] = a[i] | b[i];
      return;
    case 'bitXor':
      for (let i = start; i < end; i++) out[outStart + (i - start)] = a[i] ^ b[i];
      return;
    case 'leftShift':
      for (let i = start; i < end; i++) out[outStart + (i - start)] = a[i] << b[i];
      return;
    case 'rightArithShift':
      for (let i = start; i < end; i++) out[outStart + (i - start)] = a[i] >> b[i];
      return;
    case 'rightLogShift':
      // `>>>` produces a Uint32 — Int32Array assignment wraps it back to
      // the signed range, matching JavaScript's `(x >>> n) | 0` idiom.
      for (let i = start; i < end; i++) out[outStart + (i - start)] = a[i] >>> b[i];
      return;
  }
}

/**
 * Internal driver: run `op` element-wise over `a` and `b`, returning a
 * fresh `Int32Array` of matching length. Chunks the work for parity
 * with other parallel ops; the chunks are processed sequentially
 * in-process.
 */
function runBinary(
  a: Int32Array,
  b: Int32Array,
  op: BitwiseBinaryOp,
  options: ChunkOptions = {}
): Int32Array {
  if (a.length !== b.length) {
    throw new Error(`Array lengths must match: ${a.length} vs ${b.length}`);
  }
  const out = new Int32Array(a.length);
  if (a.length === 0) return out;

  const numChunks = Math.max(1, calculateOptimalChunks(a.length, options));
  const base = Math.floor(a.length / numChunks);
  const remainder = a.length % numChunks;

  let start = 0;
  for (let c = 0; c < numChunks; c++) {
    const len = base + (c < remainder ? 1 : 0);
    if (len === 0) continue;
    applyBinaryChunk(a, b, out, start, len, start, op);
    start += len;
  }
  return out;
}

/**
 * Bitwise AND on two equal-length `Int32Array`s.
 */
export function bitAnd(
  a: Int32Array,
  b: Int32Array,
  options?: ChunkOptions
): Int32Array {
  return runBinary(a, b, 'bitAnd', options);
}

/**
 * Bitwise OR on two equal-length `Int32Array`s.
 */
export function bitOr(
  a: Int32Array,
  b: Int32Array,
  options?: ChunkOptions
): Int32Array {
  return runBinary(a, b, 'bitOr', options);
}

/**
 * Bitwise XOR on two equal-length `Int32Array`s.
 */
export function bitXor(
  a: Int32Array,
  b: Int32Array,
  options?: ChunkOptions
): Int32Array {
  return runBinary(a, b, 'bitXor', options);
}

/**
 * Element-wise left shift: `a[i] << b[i]`.
 *
 * `b` may be either an `Int32Array` of per-element shift counts or a
 * single scalar `number` (applied uniformly). Shift counts are masked
 * to the low 5 bits by JavaScript itself — values ≥ 32 fold back into
 * `[0, 31]`.
 */
export function leftShift(
  a: Int32Array,
  b: Int32Array | number,
  options?: ChunkOptions
): Int32Array {
  if (typeof b === 'number') return runBinaryScalar(a, b, 'leftShift', options);
  return runBinary(a, b, 'leftShift', options);
}

/**
 * Element-wise arithmetic (sign-preserving) right shift: `a[i] >> b[i]`.
 */
export function rightArithShift(
  a: Int32Array,
  b: Int32Array | number,
  options?: ChunkOptions
): Int32Array {
  if (typeof b === 'number') return runBinaryScalar(a, b, 'rightArithShift', options);
  return runBinary(a, b, 'rightArithShift', options);
}

/**
 * Element-wise logical (zero-filling) right shift: `a[i] >>> b[i]`.
 *
 * Result is stored as `Int32Array`, so values ≥ 2^31 wrap into the
 * negative range — equivalent to `(x >>> n) | 0`.
 */
export function rightLogShift(
  a: Int32Array,
  b: Int32Array | number,
  options?: ChunkOptions
): Int32Array {
  if (typeof b === 'number') return runBinaryScalar(a, b, 'rightLogShift', options);
  return runBinary(a, b, 'rightLogShift', options);
}

/**
 * Unary bitwise NOT: `~a[i]`. Returns a fresh `Int32Array`.
 */
export function bitNot(a: Int32Array, options: ChunkOptions = {}): Int32Array {
  const out = new Int32Array(a.length);
  if (a.length === 0) return out;

  const numChunks = Math.max(1, calculateOptimalChunks(a.length, options));
  const base = Math.floor(a.length / numChunks);
  const remainder = a.length % numChunks;

  let start = 0;
  for (let c = 0; c < numChunks; c++) {
    const len = base + (c < remainder ? 1 : 0);
    if (len === 0) continue;
    const end = start + len;
    for (let i = start; i < end; i++) out[i] = ~a[i];
    start += len;
  }
  return out;
}

/**
 * Shared scalar-shift driver. Used for the `Int32Array, number` shift
 * overloads.
 */
function runBinaryScalar(
  a: Int32Array,
  scalar: number,
  op: BitwiseBinaryOp,
  options: ChunkOptions = {}
): Int32Array {
  const out = new Int32Array(a.length);
  if (a.length === 0) return out;

  const numChunks = Math.max(1, calculateOptimalChunks(a.length, options));
  const base = Math.floor(a.length / numChunks);
  const remainder = a.length % numChunks;

  let start = 0;
  for (let c = 0; c < numChunks; c++) {
    const len = base + (c < remainder ? 1 : 0);
    if (len === 0) continue;
    const end = start + len;
    switch (op) {
      case 'leftShift':
        for (let i = start; i < end; i++) out[i] = a[i] << scalar;
        break;
      case 'rightArithShift':
        for (let i = start; i < end; i++) out[i] = a[i] >> scalar;
        break;
      case 'rightLogShift':
        for (let i = start; i < end; i++) out[i] = a[i] >>> scalar;
        break;
      // The non-shift ops never go through the scalar path — caller
      // routes only the three shift ops here. Listed for exhaustiveness.
      case 'bitAnd':
        for (let i = start; i < end; i++) out[i] = a[i] & scalar;
        break;
      case 'bitOr':
        for (let i = start; i < end; i++) out[i] = a[i] | scalar;
        break;
      case 'bitXor':
        for (let i = start; i < end; i++) out[i] = a[i] ^ scalar;
        break;
    }
    start += len;
  }
  return out;
}
