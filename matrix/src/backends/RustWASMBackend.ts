/**
 * Rust WASM Matrix Backend
 *
 * Implements MatrixBackend using the Rust-compiled WebAssembly module (648 KB).
 * Designed for heavy operations: large matrix multiply (faer), FFT (rustfft),
 * eigendecomposition, sparse algebra, and SIMD-accelerated array operations.
 *
 * This backend sits alongside the existing WASMBackend (AssemblyScript) and
 * is selected by BackendManager for large matrices and heavy operations.
 *
 * Memory model:
 *   Uses a bump allocator on the JS side to write data into WASM linear
 *   memory. The allocator is reset between operations (batch-free pattern).
 *   This avoids the overhead of per-allocation malloc/free calls.
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { MatrixBackend, BackendType } from './Backend.js';
import { DenseMatrix } from '../types/DenseMatrix.js';
import { jsBackend } from './JSBackend.js';
import { rustWasmLoader, type RustWasmExports } from './RustWasmLoader.js';

/**
 * Rust WASM Backend configuration
 */
export interface RustWASMBackendConfig {
  /** Minimum elements to use Rust WASM (default: 1000) */
  minElements?: number;
  /** Path to the Rust WASM binary */
  wasmPath?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<RustWASMBackendConfig> = {
  minElements: 1000,
  wasmPath: '',
};

/**
 * Rust WASM Backend for matrix operations.
 *
 * Uses the Rust WASM module for heavy computation, with automatic
 * fallback to JSBackend when the module is unavailable or for small matrices.
 *
 * The backend registers as type 'wasm' so it can serve as a drop-in
 * replacement or complement to the AssemblyScript WASMBackend. When both
 * are needed, use BackendManager's operation-specific routing.
 */
export class RustWASMBackend implements MatrixBackend {
  /**
   * Backend type identifier.
   * Uses 'rust-wasm' to distinguish from the AssemblyScript WASMBackend.
   */
  readonly type: BackendType = 'rust-wasm';

  private config: Required<RustWASMBackendConfig>;
  private exports: RustWasmExports | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: RustWASMBackendConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if WebAssembly is available in the current environment.
   */
  isAvailable(): boolean {
    return typeof WebAssembly !== 'undefined';
  }

  /**
   * Initialize the Rust WASM backend.
   * Loads the WASM binary and caches the exports.
   */
  async initialize(): Promise<void> {
    if (this.exports) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('WebAssembly is not available in this environment');
    }

    const loaded = await rustWasmLoader.load(
      this.config.wasmPath || undefined
    );

    if (loaded) {
      this.exports = rustWasmLoader.getExports();
    } else {
      console.warn('Rust WASM binary not available, RustWASMBackend will use JS fallback');
    }
  }

  /**
   * Whether to use Rust WASM for this operation size.
   */
  private shouldUseRustWasm(elementCount: number): boolean {
    return this.exports !== null && elementCount >= this.config.minElements;
  }

  /**
   * Whether the Rust WASM module is loaded and ready.
   */
  get isRustLoaded(): boolean {
    return this.exports !== null;
  }

  // =========================================================================
  // Element-wise Operations
  // =========================================================================

  add(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.add(a, b);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const bPtr = rustWasmLoader.writeF64(b.toFloat64Array());
      const outPtr = rustWasmLoader.allocF64(n);

      this.exports!.simdAddF64(aPtr, bPtr, outPtr, n);

      const result = rustWasmLoader.readF64(outPtr, n);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } catch {
      return jsBackend.add(a, b);
    }
  }

  subtract(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.subtract(a, b);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const bPtr = rustWasmLoader.writeF64(b.toFloat64Array());
      const outPtr = rustWasmLoader.allocF64(n);

      this.exports!.simdSubF64(aPtr, bPtr, outPtr, n);

      const result = rustWasmLoader.readF64(outPtr, n);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } catch {
      return jsBackend.subtract(a, b);
    }
  }

  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.multiplyElementwise(a, b);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const bPtr = rustWasmLoader.writeF64(b.toFloat64Array());
      const outPtr = rustWasmLoader.allocF64(n);

      this.exports!.simdMulF64(aPtr, bPtr, outPtr, n);

      const result = rustWasmLoader.readF64(outPtr, n);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } catch {
      return jsBackend.multiplyElementwise(a, b);
    }
  }

  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    // Rust WASM has simdDivF64 but it's not in our core export interface.
    // Fall back to JS for now.
    return jsBackend.divideElementwise(a, b);
  }

  scale(a: DenseMatrix, scalar: number): DenseMatrix {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.scale(a, scalar);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const outPtr = rustWasmLoader.allocF64(n);

      this.exports!.simdScaleF64(aPtr, scalar, outPtr, n);

      const result = rustWasmLoader.readF64(outPtr, n);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } catch {
      return jsBackend.scale(a, scalar);
    }
  }

  abs(a: DenseMatrix): DenseMatrix {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.abs(a);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const outPtr = rustWasmLoader.allocF64(n);

      this.exports!.simdAbsF64(aPtr, outPtr, n);

      const result = rustWasmLoader.readF64(outPtr, n);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } catch {
      return jsBackend.abs(a);
    }
  }

  negate(a: DenseMatrix): DenseMatrix {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.negate(a);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const outPtr = rustWasmLoader.allocF64(n);

      this.exports!.simdScaleF64(aPtr, -1, outPtr, n);

      const result = rustWasmLoader.readF64(outPtr, n);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } catch {
      return jsBackend.negate(a);
    }
  }

  // =========================================================================
  // Matrix Operations
  // =========================================================================

  multiply(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols + b.rows * b.cols;
    if (!this.shouldUseRustWasm(elementCount)) return jsBackend.multiply(a, b);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const bPtr = rustWasmLoader.writeF64(b.toFloat64Array());
      const resultSize = a.rows * b.cols;
      const outPtr = rustWasmLoader.allocF64(resultSize);

      // Use SIMD-accelerated multiply (faer-based)
      this.exports!.multiplyDenseSIMD(
        aPtr, a.rows, a.cols,
        bPtr, b.rows, b.cols,
        outPtr
      );

      const result = rustWasmLoader.readF64(outPtr, resultSize);
      return DenseMatrix.fromFlat(a.rows, b.cols, Array.from(result));
    } catch {
      return jsBackend.multiply(a, b);
    }
  }

  transpose(a: DenseMatrix): DenseMatrix {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.transpose(a);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const outPtr = rustWasmLoader.allocF64(n);

      this.exports!.transpose(aPtr, a.rows, a.cols, outPtr);

      const result = rustWasmLoader.readF64(outPtr, n);
      return DenseMatrix.fromFlat(a.cols, a.rows, Array.from(result));
    } catch {
      return jsBackend.transpose(a);
    }
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  sum(a: DenseMatrix): number {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.sum(a) as number;

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      return this.exports!.simdSumF64(aPtr, n);
    } catch {
      return jsBackend.sum(a) as number;
    }
  }

  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix {
    // Axis reduction is not directly supported by Rust WASM exports.
    return jsBackend.sumAxis(a, axis);
  }

  norm(a: DenseMatrix): number {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.norm(a);

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      return this.exports!.simdNormF64(aPtr, n);
    } catch {
      return jsBackend.norm(a);
    }
  }

  dot(a: DenseMatrix, b: DenseMatrix): number {
    const n = a.rows * a.cols;
    if (!this.shouldUseRustWasm(n)) return jsBackend.dot(a, b) as number;

    try {
      rustWasmLoader.resetAllocator();
      const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
      const bPtr = rustWasmLoader.writeF64(b.toFloat64Array());
      return this.exports!.simdDotF64(aPtr, bPtr, n);
    } catch {
      return jsBackend.dot(a, b) as number;
    }
  }

  // =========================================================================
  // Heavy Operations (unique to Rust backend)
  // =========================================================================

  /**
   * LU Decomposition using Rust WASM.
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

    if (!this.exports) {
      throw new Error('Rust WASM not loaded');
    }

    rustWasmLoader.resetAllocator();
    const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
    const permPtr = rustWasmLoader.allocI32(n);

    const success = this.exports.luDecomposition(aPtr, n, permPtr);

    return {
      lu: DenseMatrix.fromFlat(n, n, Array.from(rustWasmLoader.readF64(aPtr, n * n))),
      perm: rustWasmLoader.readI32(permPtr, n),
      singular: success === 0,
    };
  }

  /**
   * Eigenvalue decomposition for symmetric matrices using Rust WASM.
   */
  async eigsSymmetric(a: DenseMatrix, precision: number = 1e-12): Promise<{
    eigenvalues: Float64Array;
    eigenvectors: DenseMatrix;
    iterations: number;
  }> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Eigendecomposition requires a square matrix');
    }

    if (!this.exports) {
      throw new Error('Rust WASM not loaded');
    }

    rustWasmLoader.resetAllocator();
    const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
    const eigvalsPtr = rustWasmLoader.allocF64(n);
    const eigvecsPtr = rustWasmLoader.allocF64(n * n);
    const workPtr = rustWasmLoader.allocF64(n * n);

    const iterations = this.exports.eigsSymmetric(
      aPtr, n, precision, eigvalsPtr, eigvecsPtr, workPtr
    );

    return {
      eigenvalues: rustWasmLoader.readF64(eigvalsPtr, n),
      eigenvectors: DenseMatrix.fromFlat(n, n, Array.from(rustWasmLoader.readF64(eigvecsPtr, n * n))),
      iterations,
    };
  }

  /**
   * Matrix inversion using Rust WASM.
   */
  async inverse(a: DenseMatrix): Promise<{
    inverse: DenseMatrix;
    singular: boolean;
  }> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Matrix inversion requires a square matrix');
    }

    if (!this.exports) {
      throw new Error('Rust WASM not loaded');
    }

    rustWasmLoader.resetAllocator();
    const aPtr = rustWasmLoader.writeF64(a.toFloat64Array());
    const resultPtr = rustWasmLoader.allocF64(n * n);
    const workPtr = rustWasmLoader.allocF64(n * n);

    const success = this.exports.laInv(aPtr, n, resultPtr, workPtr);

    return {
      inverse: DenseMatrix.fromFlat(n, n, Array.from(rustWasmLoader.readF64(resultPtr, n * n))),
      singular: success === 0,
    };
  }

  /**
   * FFT using Rust WASM (rustfft).
   * Data is interleaved complex: [re0, im0, re1, im1, ...].
   */
  fft(data: Float64Array, n: number, inverse: boolean = false): Float64Array {
    if (!this.exports) {
      throw new Error('Rust WASM not loaded');
    }

    rustWasmLoader.resetAllocator();
    const dataPtr = rustWasmLoader.writeF64(data);

    this.exports.fft(dataPtr, n, inverse ? 1 : 0);

    return rustWasmLoader.readF64(dataPtr, n * 2);
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<RustWASMBackendConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   */
  getConfig(): Required<RustWASMBackendConfig> {
    return { ...this.config };
  }
}

/**
 * Global Rust WASM backend instance
 */
export const rustWasmBackend = new RustWASMBackend();

/**
 * Create a Rust WASM backend with custom configuration
 */
export function createRustWASMBackend(config?: RustWASMBackendConfig): RustWASMBackend {
  return new RustWASMBackend(config);
}
