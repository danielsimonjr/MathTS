/**
 * GPU Matrix Backend Adapter
 *
 * Adapts GPUBackend to implement the MatrixBackend interface,
 * enabling seamless integration with the backend selection system.
 *
 * @packageDocumentation
 */

import type { MatrixBackend, BackendType } from './Backend.js';
import { DenseMatrix } from '../types/DenseMatrix.js';
import { jsBackend } from './JSBackend.js';
import {
  GPUBackend,
  getGlobalGPUBackend,
  initializeGlobalGPUBackend,
  type GPUBackendOptions,
} from './GPUBackend.js';
import { hasWebGPU, detectGPUCapabilities, type GPUCapabilities } from './gpu/index.js';

/**
 * Configuration for GPU Matrix Backend
 */
export interface GPUMatrixBackendConfig {
  /** Minimum elements to use GPU (default: 65536 = 256x256) */
  minElements?: number;
  /** Use global GPU backend instance */
  useGlobalBackend?: boolean;
  /** GPU backend options */
  gpuOptions?: GPUBackendOptions;
  /** Fall back to JS on GPU errors */
  fallbackOnError?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<GPUMatrixBackendConfig> = {
  minElements: 65536, // 256x256
  useGlobalBackend: true,
  gpuOptions: {},
  fallbackOnError: true,
};

/**
 * GPU Matrix Backend
 *
 * Implements MatrixBackend interface using WebGPU compute shaders.
 * Provides significant acceleration for large matrices.
 *
 * @example
 * ```typescript
 * const gpu = new GPUMatrixBackend();
 * await gpu.initialize();
 *
 * const result = gpu.multiply(matrixA, matrixB);
 * ```
 */
export class GPUMatrixBackend implements MatrixBackend {
  readonly type: BackendType = 'gpu';

  private config: Required<GPUMatrixBackendConfig>;
  private backend: GPUBackend | null = null;
  private capabilities: GPUCapabilities | null = null;
  private initPromise: Promise<void> | null = null;
  private _available: boolean | null = null;

  constructor(config: GPUMatrixBackendConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if GPU is available in the current environment
   */
  isAvailable(): boolean {
    if (this._available !== null) {
      return this._available;
    }
    this._available = hasWebGPU();
    return this._available;
  }

  /**
   * Initialize the GPU backend
   */
  async initialize(): Promise<void> {
    if (this.backend?.isReady) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('WebGPU is not available in this environment');
    }

    // Detect capabilities
    this.capabilities = await detectGPUCapabilities(
      this.config.gpuOptions?.preferHighPerformance ?? true
    );

    if (!this.capabilities.supported) {
      throw new Error('WebGPU adapter not available');
    }

    // Initialize backend
    if (this.config.useGlobalBackend) {
      const success = await initializeGlobalGPUBackend(this.config.gpuOptions);
      if (!success) {
        throw new Error('Failed to initialize global GPU backend');
      }
      this.backend = getGlobalGPUBackend();
    } else {
      this.backend = new GPUBackend(this.config.gpuOptions);
      const success = await this.backend.initialize(this.config.gpuOptions);
      if (!success) {
        throw new Error(`Failed to initialize GPU backend: ${this.backend.lastError?.message}`);
      }
    }
  }

  /**
   * Check if operation should use GPU
   */
  private shouldUseGPU(elementCount: number): boolean {
    return this.backend !== null && this.backend.isReady && elementCount >= this.config.minElements;
  }

  /**
   * Execute GPU operation with fallback
   */
  private async executeWithFallback<T>(gpuOp: () => Promise<T>, fallback: () => T): Promise<T> {
    if (!this.config.fallbackOnError) {
      return gpuOp();
    }

    try {
      return await gpuOp();
    } catch (error) {
      console.warn('GPU operation failed, falling back to JS:', error);
      return fallback();
    }
  }

  /**
   * Get GPU capabilities
   */
  getCapabilities(): GPUCapabilities | null {
    return this.capabilities;
  }

  /**
   * Get backend statistics
   */
  getStats(): ReturnType<GPUBackend['getStats']> | null {
    return this.backend?.getStats() ?? null;
  }

  // =========================================================================
  // Element-wise Operations
  // =========================================================================

  add(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.add(a, b);
    }

    // GPU add is async, so we need to run it synchronously by executing
    // and blocking. For truly async behavior, use addAsync.
    // For MatrixBackend interface compatibility, we use JS fallback
    // when sync is required.
    return jsBackend.add(a, b);
  }

  /**
   * Async add operation using GPU
   */
  async addAsync(a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.add(a, b);
    }

    return this.executeWithFallback(
      async () => {
        const aData = new Float32Array(a.toFloat64Array());
        const bData = new Float32Array(b.toFloat64Array());
        const result = await this.backend!.add(aData, bData, a.rows, a.cols);
        return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
      },
      () => jsBackend.add(a, b)
    );
  }

  subtract(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.subtract(a, b);
    }

    // Sync interface falls back to JS
    return jsBackend.subtract(a, b);
  }

  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.multiplyElementwise(a, b);
    }

    return jsBackend.multiplyElementwise(a, b);
  }

  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.divideElementwise(a, b);
    }

    return jsBackend.divideElementwise(a, b);
  }

  scale(a: DenseMatrix, scalar: number): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.scale(a, scalar);
    }

    return jsBackend.scale(a, scalar);
  }

  /**
   * Async scale operation using GPU
   */
  async scaleAsync(a: DenseMatrix, scalar: number): Promise<DenseMatrix> {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.scale(a, scalar);
    }

    return this.executeWithFallback(
      async () => {
        const aData = new Float32Array(a.toFloat64Array());
        const result = await this.backend!.scale(aData, scalar);
        return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
      },
      () => jsBackend.scale(a, scalar)
    );
  }

  abs(a: DenseMatrix): DenseMatrix {
    return jsBackend.abs(a);
  }

  negate(a: DenseMatrix): DenseMatrix {
    return jsBackend.negate(a);
  }

  // =========================================================================
  // Matrix Operations
  // =========================================================================

  multiply(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * b.cols * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.multiply(a, b);
    }

    // For sync interface, fall back to JS
    return jsBackend.multiply(a, b);
  }

  /**
   * Async matrix multiplication using GPU
   */
  async multiplyAsync(a: DenseMatrix, b: DenseMatrix): Promise<DenseMatrix> {
    const elementCount = a.rows * b.cols * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.multiply(a, b);
    }

    return this.executeWithFallback(
      async () => {
        const aData = new Float32Array(a.toFloat64Array());
        const bData = new Float32Array(b.toFloat64Array());
        const result = await this.backend!.matmul(aData, bData, a.rows, a.cols, b.cols);
        return DenseMatrix.fromFlat(a.rows, b.cols, Array.from(result));
      },
      () => jsBackend.multiply(a, b)
    );
  }

  transpose(a: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.transpose(a);
    }

    return jsBackend.transpose(a);
  }

  /**
   * Async transpose using GPU
   */
  async transposeAsync(a: DenseMatrix): Promise<DenseMatrix> {
    const elementCount = a.rows * a.cols;

    if (!this.shouldUseGPU(elementCount)) {
      return jsBackend.transpose(a);
    }

    return this.executeWithFallback(
      async () => {
        const aData = new Float32Array(a.toFloat64Array());
        const result = await this.backend!.transpose(aData, a.rows, a.cols);
        return DenseMatrix.fromFlat(a.cols, a.rows, Array.from(result));
      },
      () => jsBackend.transpose(a)
    );
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  sum(a: DenseMatrix): number {
    return jsBackend.sum(a) as number;
  }

  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix {
    return jsBackend.sumAxis(a, axis);
  }

  norm(a: DenseMatrix): number {
    return jsBackend.norm(a);
  }

  dot(a: DenseMatrix, b: DenseMatrix): number {
    return jsBackend.dot(a, b) as number;
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GPUMatrixBackendConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<GPUMatrixBackendConfig> {
    return { ...this.config };
  }

  /**
   * Destroy the backend
   */
  destroy(): void {
    if (this.backend && !this.config.useGlobalBackend) {
      this.backend.destroy();
    }
    this.backend = null;
  }
}

/**
 * Global GPU matrix backend instance
 */
export const gpuMatrixBackend = new GPUMatrixBackend();

/**
 * Create a GPU matrix backend with custom configuration
 */
export function createGPUMatrixBackend(config?: GPUMatrixBackendConfig): GPUMatrixBackend {
  return new GPUMatrixBackend(config);
}
