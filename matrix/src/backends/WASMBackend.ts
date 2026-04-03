/**
 * WASM Matrix Backend
 *
 * Implements MatrixBackend using WebAssembly for accelerated operations.
 * Falls back to JSBackend when WASM is unavailable or for small matrices.
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { MatrixBackend, BackendType } from './Backend.js';
import { DenseMatrix } from '../types/DenseMatrix.js';
import { jsBackend } from './JSBackend.js';
import { wasmLoader, type WasmModule } from './WasmLoader.js';
import { detectWasmFeatures, type WasmFeatures } from './wasm/detect.js';

/**
 * WASM Backend configuration
 */
export interface WASMBackendConfig {
  /** Minimum elements to use WASM (default: 100) */
  minElements?: number;
  /** Path to WASM file */
  wasmPath?: string;
  /** Enable SIMD optimizations when available */
  useSIMD?: boolean;
}

/**
 * Default WASM backend configuration
 */
const DEFAULT_CONFIG: Required<WASMBackendConfig> = {
  minElements: 100,
  wasmPath: '',
  useSIMD: true,
};

/**
 * WASM Backend for matrix operations
 *
 * Uses WebAssembly for accelerated matrix operations with SIMD support.
 * Automatically falls back to JavaScript for small matrices or when WASM unavailable.
 */
export class WASMBackend implements MatrixBackend {
  readonly type: BackendType = 'wasm';

  private config: Required<WASMBackendConfig>;
  private wasmModule: WasmModule | null = null;
  private features: WasmFeatures | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: WASMBackendConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if WASM is available in the current environment
   */
  isAvailable(): boolean {
    return typeof WebAssembly !== 'undefined';
  }

  /**
   * Initialize the WASM backend
   */
  async initialize(): Promise<void> {
    if (this.wasmModule) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('WebAssembly is not available in this environment');
    }

    // Detect WASM features
    this.features = await detectWasmFeatures();

    // Load WASM module
    try {
      this.wasmModule = await wasmLoader.load(
        this.config.wasmPath || undefined
      );
    } catch (error) {
      console.warn('Failed to load WASM module, falling back to JS:', error);
      this.wasmModule = null;
    }
  }

  /**
   * Check if operation should use WASM
   */
  private shouldUseWasm(elementCount: number): boolean {
    return (
      this.wasmModule !== null &&
      elementCount >= this.config.minElements
    );
  }

  /**
   * Get detected WASM features
   */
  getFeatures(): WasmFeatures | null {
    return this.features;
  }

  // =========================================================================
  // Element-wise Operations
  // =========================================================================

  add(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.add(a, b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const bAlloc = wasmLoader.allocateFloat64Array(bData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(elementCount));

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        this.wasmModule!.simdAddF64(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      } else {
        this.wasmModule!.add(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      }
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(bAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  subtract(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.subtract(a, b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const bAlloc = wasmLoader.allocateFloat64Array(bData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(elementCount));

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        this.wasmModule!.simdSubF64(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      } else {
        this.wasmModule!.subtract(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      }
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(bAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.multiplyElementwise(a, b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const bAlloc = wasmLoader.allocateFloat64Array(bData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(elementCount));

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        this.wasmModule!.simdMulF64(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      } else {
        this.wasmModule!.simdMulF64(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      }
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(bAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.divideElementwise(a, b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const bAlloc = wasmLoader.allocateFloat64Array(bData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(elementCount));

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        this.wasmModule!.simdMulF64(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      } else {
        this.wasmModule!.simdMulF64(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      }
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(bAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  scale(a: DenseMatrix, scalar: number): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.scale(a, scalar);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(elementCount));

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        this.wasmModule!.simdScaleF64(aAlloc.ptr, scalar, elementCount, resultAlloc.ptr);
      } else {
        this.wasmModule!.scalarMultiply(aAlloc.ptr, scalar, elementCount, resultAlloc.ptr);
      }
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  abs(a: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.abs(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(elementCount));

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        this.wasmModule!.simdAbsF64(aAlloc.ptr, elementCount, resultAlloc.ptr);
      } else {
        this.wasmModule!.simdAbsF64(aAlloc.ptr, elementCount, resultAlloc.ptr);
      }
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  negate(a: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.negate(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(elementCount));

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        this.wasmModule!.simdScaleF64(aAlloc.ptr, -1, elementCount, resultAlloc.ptr);
      } else {
        this.wasmModule!.simdScaleF64(aAlloc.ptr, -1, elementCount, resultAlloc.ptr);
      }
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  // =========================================================================
  // Matrix Operations
  // =========================================================================

  multiply(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols + b.rows * b.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.multiply(a, b);
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const bAlloc = wasmLoader.allocateFloat64Array(bData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(a.rows * b.cols));

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        this.wasmModule!.multiplyDenseSIMD(
          aAlloc.ptr, a.rows, a.cols,
          bAlloc.ptr, b.rows, b.cols,
          resultAlloc.ptr
        );
      } else {
        this.wasmModule!.multiplyDense(
          aAlloc.ptr, a.rows, a.cols,
          bAlloc.ptr, b.rows, b.cols,
          resultAlloc.ptr
        );
      }

      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, b.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(bAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  transpose(a: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.transpose(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(elementCount));

    try {
      this.wasmModule!.transpose(aAlloc.ptr, a.rows, a.cols, resultAlloc.ptr);
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.cols, a.rows, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  sum(a: DenseMatrix): number {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.sum(a) as number;
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        return this.wasmModule!.simdSumF64(aAlloc.ptr, elementCount);
      } else {
        return this.wasmModule!.simdSumF64(aAlloc.ptr, elementCount);
      }
    } finally {
      wasmLoader.free(aAlloc.ptr);
    }
  }

  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix {
    // Use JS backend for axis reductions
    return jsBackend.sumAxis(a, axis);
  }

  norm(a: DenseMatrix): number {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.norm(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        return this.wasmModule!.simdNormF64(aAlloc.ptr, elementCount);
      } else {
        return this.wasmModule!.simdNormF64(aAlloc.ptr, elementCount);
      }
    } finally {
      wasmLoader.free(aAlloc.ptr);
    }
  }

  dot(a: DenseMatrix, b: DenseMatrix): number {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseWasm(elementCount)) {
      return jsBackend.dot(a, b) as number;
    }

    const aData = a.toFloat64Array();
    const bData = b.toFloat64Array();

    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const bAlloc = wasmLoader.allocateFloat64Array(bData);

    try {
      // Use SIMD-optimized version if available
      if (this.config.useSIMD && this.features?.simd) {
        return this.wasmModule!.simdDotF64(aAlloc.ptr, bAlloc.ptr, elementCount);
      } else {
        return this.wasmModule!.dotProduct(aAlloc.ptr, bAlloc.ptr, elementCount);
      }
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(bAlloc.ptr);
    }
  }

  // =========================================================================
  // LU Decomposition (WASM-accelerated)
  // =========================================================================

  /**
   * LU Decomposition using WASM
   */
  async luDecomposition(a: DenseMatrix): Promise<{
    lu: DenseMatrix;
    perm: Int32Array;
    singular: boolean;
  }> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('LU decomposition requires a square matrix');
    }

    if (!this.shouldUseWasm(n * n)) {
      // Fall back to JS implementation
      return this.luDecompositionJS(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const permAlloc = wasmLoader.allocateInt32Array(new Int32Array(n));

    try {
      const success = this.wasmModule!.luDecomposition(aAlloc.ptr, n, permAlloc.ptr);

      return {
        lu: DenseMatrix.fromFlat(n, n, Array.from(new Float64Array(aAlloc.array))),
        perm: new Int32Array(permAlloc.array),
        singular: success === 0,
      };
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(permAlloc.ptr);
    }
  }

  private luDecompositionJS(a: DenseMatrix): {
    lu: DenseMatrix;
    perm: Int32Array;
    singular: boolean;
  } {
    const n = a.rows;
    const data = new Float64Array(a.toFloat64Array());
    const perm = new Int32Array(n);

    for (let i = 0; i < n; i++) {
      perm[i] = i;
    }

    for (let k = 0; k < n - 1; k++) {
      let maxVal = Math.abs(data[k * n + k]);
      let pivotRow = k;

      for (let i = k + 1; i < n; i++) {
        const val = Math.abs(data[i * n + k]);
        if (val > maxVal) {
          maxVal = val;
          pivotRow = i;
        }
      }

      if (maxVal < 1e-14) {
        return { lu: DenseMatrix.fromFlat(n, n, Array.from(data)), perm, singular: true };
      }

      if (pivotRow !== k) {
        for (let j = 0; j < n; j++) {
          const temp = data[k * n + j];
          data[k * n + j] = data[pivotRow * n + j];
          data[pivotRow * n + j] = temp;
        }
        const temp = perm[k];
        perm[k] = perm[pivotRow];
        perm[pivotRow] = temp;
      }

      const pivot = data[k * n + k];
      for (let i = k + 1; i < n; i++) {
        const factor = data[i * n + k] / pivot;
        data[i * n + k] = factor;

        for (let j = k + 1; j < n; j++) {
          data[i * n + j] -= factor * data[k * n + j];
        }
      }
    }

    return { lu: DenseMatrix.fromFlat(n, n, Array.from(data)), perm, singular: false };
  }

  // =========================================================================
  // QR Decomposition (WASM-accelerated)
  // =========================================================================

  /**
   * QR Decomposition using WASM
   */
  async qrDecomposition(a: DenseMatrix): Promise<{
    q: DenseMatrix;
    r: DenseMatrix;
  }> {
    const m = a.rows;
    const n = a.cols;

    if (!this.shouldUseWasm(m * n)) {
      return this.qrDecompositionJS(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const qAlloc = wasmLoader.allocateFloat64Array(new Float64Array(m * m));
    const rAlloc = wasmLoader.allocateFloat64Array(new Float64Array(m * n));

    try {
      this.wasmModule!.qrDecomposition(aAlloc.ptr, m, n, qAlloc.ptr);

      return {
        q: DenseMatrix.fromFlat(m, m, Array.from(new Float64Array(qAlloc.array))),
        r: DenseMatrix.fromFlat(m, n, Array.from(new Float64Array(rAlloc.array))),
      };
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(qAlloc.ptr);
      wasmLoader.free(rAlloc.ptr);
    }
  }

  private qrDecompositionJS(a: DenseMatrix): { q: DenseMatrix; r: DenseMatrix } {
    const m = a.rows;
    const n = a.cols;
    const aData = a.toFloat64Array();
    const r = new Float64Array(m * n);
    const q = new Float64Array(m * m);

    // Copy a to r
    for (let i = 0; i < m * n; i++) {
      r[i] = aData[i];
    }

    // Initialize Q as identity
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        q[i * m + j] = i === j ? 1.0 : 0.0;
      }
    }

    const minDim = Math.min(m, n);

    for (let k = 0; k < minDim; k++) {
      let norm = 0.0;
      for (let i = k; i < m; i++) {
        const val = r[i * n + k];
        norm += val * val;
      }
      norm = Math.sqrt(norm);

      if (norm < 1e-14) continue;

      const sign = r[k * n + k] >= 0.0 ? 1.0 : -1.0;
      const u1 = r[k * n + k] + sign * norm;

      const v = new Float64Array(m - k);
      v[0] = 1.0;
      for (let i = 1; i < m - k; i++) {
        v[i] = r[(k + i) * n + k] / u1;
      }

      let vDotV = 0.0;
      for (let i = 0; i < m - k; i++) {
        vDotV += v[i] * v[i];
      }
      const tau = 2.0 / vDotV;

      // Apply to R
      for (let j = k; j < n; j++) {
        let vDotCol = 0.0;
        for (let i = 0; i < m - k; i++) {
          vDotCol += v[i] * r[(k + i) * n + j];
        }
        const factor = tau * vDotCol;
        for (let i = 0; i < m - k; i++) {
          r[(k + i) * n + j] -= factor * v[i];
        }
      }

      // Apply to Q
      for (let j = 0; j < m; j++) {
        let vDotCol = 0.0;
        for (let i = 0; i < m - k; i++) {
          vDotCol += v[i] * q[(k + i) * m + j];
        }
        const factor = tau * vDotCol;
        for (let i = 0; i < m - k; i++) {
          q[(k + i) * m + j] -= factor * v[i];
        }
      }
    }

    return {
      q: DenseMatrix.fromFlat(m, m, Array.from(q)),
      r: DenseMatrix.fromFlat(m, n, Array.from(r)),
    };
  }

  // =========================================================================
  // Matrix Inversion (WASM-accelerated)
  // =========================================================================

  /**
   * Matrix inversion using LU decomposition
   */
  async inverse(a: DenseMatrix): Promise<{ inverse: DenseMatrix; singular: boolean }> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Matrix inversion requires a square matrix');
    }

    if (!this.shouldUseWasm(n * n)) {
      return this.inverseJS(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const resultAlloc = wasmLoader.allocateFloat64Array(new Float64Array(n * n));
    const workAlloc = wasmLoader.allocateFloat64Array(new Float64Array(n * n));

    try {
      const success = this.wasmModule!.laInv(aAlloc.ptr, n, resultAlloc.ptr, workAlloc.ptr);

      return {
        inverse: DenseMatrix.fromFlat(n, n, Array.from(new Float64Array(resultAlloc.array))),
        singular: success === 0,
      };
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
      wasmLoader.free(workAlloc.ptr);
    }
  }

  private async inverseJS(a: DenseMatrix): Promise<{ inverse: DenseMatrix; singular: boolean }> {
    const n = a.rows;
    const { lu, perm, singular } = this.luDecompositionJS(a);

    if (singular) {
      return { inverse: DenseMatrix.zeros(n, n), singular: true };
    }

    const luData = lu.toFloat64Array();
    const result = new Float64Array(n * n);
    const b = new Float64Array(n);
    const x = new Float64Array(n);

    for (let col = 0; col < n; col++) {
      // Create column of identity
      for (let i = 0; i < n; i++) {
        b[i] = i === col ? 1.0 : 0.0;
      }

      // Forward substitution
      for (let i = 0; i < n; i++) {
        let sum = b[perm[i]];
        for (let j = 0; j < i; j++) {
          sum -= luData[i * n + j] * x[j];
        }
        x[i] = sum;
      }

      // Backward substitution
      for (let i = n - 1; i >= 0; i--) {
        let sum = x[i];
        for (let j = i + 1; j < n; j++) {
          sum -= luData[i * n + j] * x[j];
        }
        x[i] = sum / luData[i * n + i];
      }

      // Store column
      for (let i = 0; i < n; i++) {
        result[i * n + col] = x[i];
      }
    }

    return { inverse: DenseMatrix.fromFlat(n, n, Array.from(result)), singular: false };
  }

  // =========================================================================
  // Determinant (WASM-accelerated)
  // =========================================================================

  /**
   * Compute matrix determinant using LU decomposition
   */
  async determinantWasm(a: DenseMatrix): Promise<number> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Determinant requires a square matrix');
    }

    if (!this.shouldUseWasm(n * n)) {
      return this.determinantJS(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const permAlloc = wasmLoader.allocateFloat64Array(new Float64Array(n));

    try {
      return this.wasmModule!.luDeterminant(aAlloc.ptr, n, permAlloc.ptr);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(permAlloc.ptr);
    }
  }

  private determinantJS(a: DenseMatrix): number {
    const n = a.rows;
    const { lu, perm, singular } = this.luDecompositionJS(a);

    if (singular) {
      return 0.0;
    }

    const luData = lu.toFloat64Array();
    let det = 1.0;

    for (let i = 0; i < n; i++) {
      det *= luData[i * n + i];
    }

    // Count row swaps
    let swaps = 0;
    for (let i = 0; i < n; i++) {
      if (perm[i] !== i) swaps++;
    }

    return swaps % 2 === 0 ? det : -det;
  }

  // =========================================================================
  // Cholesky Decomposition (WASM-accelerated)
  // =========================================================================

  /**
   * Cholesky Decomposition using WASM
   * For symmetric positive-definite matrices: A = L * L^T
   */
  async choleskyDecomposition(a: DenseMatrix): Promise<{
    l: DenseMatrix;
    positiveDefinite: boolean;
  }> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Cholesky decomposition requires a square matrix');
    }

    if (!this.shouldUseWasm(n * n)) {
      return this.choleskyDecompositionJS(a);
    }

    const aData = a.toFloat64Array();
    const aAlloc = wasmLoader.allocateFloat64Array(aData);
    const lAlloc = wasmLoader.allocateFloat64Array(new Float64Array(n * n));

    try {
      const success = this.wasmModule!.choleskyDecomposition(aAlloc.ptr, n, lAlloc.ptr);

      return {
        l: DenseMatrix.fromFlat(n, n, Array.from(new Float64Array(lAlloc.array))),
        positiveDefinite: success === 1,
      };
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(lAlloc.ptr);
    }
  }

  private choleskyDecompositionJS(a: DenseMatrix): { l: DenseMatrix; positiveDefinite: boolean } {
    const n = a.rows;
    const aData = a.toFloat64Array();
    const l = new Float64Array(n * n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = aData[i * n + j];

        for (let k = 0; k < j; k++) {
          sum -= l[i * n + k] * l[j * n + k];
        }

        if (i === j) {
          if (sum <= 0.0) {
            return { l: DenseMatrix.zeros(n, n), positiveDefinite: false };
          }
          l[i * n + j] = Math.sqrt(sum);
        } else {
          l[i * n + j] = sum / l[j * n + j];
        }
      }
    }

    return { l: DenseMatrix.fromFlat(n, n, Array.from(l)), positiveDefinite: true };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WASMBackendConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<WASMBackendConfig> {
    return { ...this.config };
  }
}

/**
 * Global WASM backend instance
 */
export const wasmBackend = new WASMBackend();

/**
 * Create a WASM backend with custom configuration
 */
export function createWASMBackend(config?: WASMBackendConfig): WASMBackend {
  return new WASMBackend(config);
}
