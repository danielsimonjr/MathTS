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
      this.wasmModule!.add(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
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
      this.wasmModule!.subtract(aAlloc.ptr, bAlloc.ptr, elementCount, resultAlloc.ptr);
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(bAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    // Element-wise multiply not directly in WASM interface
    // Fall back to JS for now
    return jsBackend.multiplyElementwise(a, b);
  }

  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    // Element-wise divide not directly in WASM interface
    // Fall back to JS for now
    return jsBackend.divideElementwise(a, b);
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
      this.wasmModule!.scalarMultiply(aAlloc.ptr, scalar, elementCount, resultAlloc.ptr);
      const resultData = Array.from(new Float64Array(resultAlloc.array));
      return DenseMatrix.fromFlat(a.rows, a.cols, resultData);
    } finally {
      wasmLoader.free(aAlloc.ptr);
      wasmLoader.free(resultAlloc.ptr);
    }
  }

  abs(a: DenseMatrix): DenseMatrix {
    // No direct WASM function, use JS
    return jsBackend.abs(a);
  }

  negate(a: DenseMatrix): DenseMatrix {
    // Use scale with -1
    return this.scale(a, -1);
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
    // Use JS backend - no direct WASM sum function
    return jsBackend.sum(a) as number;
  }

  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix {
    // Use JS backend for axis reductions
    return jsBackend.sumAxis(a, axis);
  }

  norm(a: DenseMatrix): number {
    return jsBackend.norm(a);
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
      return this.wasmModule!.dotProduct(aAlloc.ptr, bAlloc.ptr, elementCount);
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
