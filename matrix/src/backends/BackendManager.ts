/**
 * Backend Manager
 *
 * Centralized management for matrix operation backends with automatic
 * selection based on matrix size, operation type, and availability.
 *
 * @packageDocumentation
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import type { MatrixBackend, BackendType, BackendHints } from './Backend.js';
import { backendRegistry, DEFAULT_BACKEND_HINTS } from './Backend.js';
import { jsBackend } from './JSBackend.js';

/**
 * Operation type hints for backend selection
 */
export type OperationType =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'multiplyElementwise'
  | 'transpose'
  | 'scale'
  | 'decomposition'
  | 'solve';

/**
 * Extended backend hints with operation-specific thresholds
 */
export interface ExtendedBackendHints extends BackendHints {
  /** Specific thresholds by operation type */
  operationThresholds?: Partial<Record<OperationType, { wasm?: number; gpu?: number }>>;
  /** Enable automatic SIMD detection for WASM */
  autoSIMD?: boolean;
  /** Fallback to JS on backend failure */
  fallbackOnError?: boolean;
}

/**
 * Default extended hints
 */
export const DEFAULT_EXTENDED_HINTS: Required<ExtendedBackendHints> = {
  ...DEFAULT_BACKEND_HINTS,
  operationThresholds: {
    multiply: { wasm: 500, gpu: 50000 },
    decomposition: { wasm: 100, gpu: 10000 },
    transpose: { wasm: 2000, gpu: 200000 },
  },
  autoSIMD: true,
  fallbackOnError: true,
};

/**
 * Centralized Backend Manager
 *
 * Provides a unified interface for executing matrix operations with
 * automatic backend selection based on matrix size and operation type.
 */
export class BackendManager {
  private hints: Required<ExtendedBackendHints>;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(hints: ExtendedBackendHints = {}) {
    this.hints = { ...DEFAULT_EXTENDED_HINTS, ...hints };
  }

  /**
   * Initialize all available backends
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    const available = backendRegistry.available();

    // Initialize backends in parallel
    const initPromises = available.map(async (type) => {
      try {
        await backendRegistry.initialize(type);
      } catch (error) {
        console.warn(`Failed to initialize ${type} backend:`, error);
      }
    });

    await Promise.all(initPromises);
    this.initialized = true;
  }

  /**
   * Update backend hints
   */
  setHints(hints: ExtendedBackendHints): void {
    this.hints = { ...this.hints, ...hints };
    backendRegistry.setHints(hints);
  }

  /**
   * Get current hints
   */
  getHints(): Required<ExtendedBackendHints> {
    return { ...this.hints };
  }

  /**
   * Get the best backend for a given operation and matrix size
   */
  selectBackend(
    elementCount: number,
    operation?: OperationType
  ): MatrixBackend {
    const { preferredBackend, operationThresholds, wasmThreshold, gpuThreshold } =
      this.hints;

    // Check preferred backend first
    if (preferredBackend !== 'js' && backendRegistry.has(preferredBackend)) {
      const backend = backendRegistry.get(preferredBackend);
      if (backend) {
        return backend;
      }
    }

    // Get operation-specific thresholds
    let wasmThresh = wasmThreshold;
    let gpuThresh = gpuThreshold;

    if (operation && operationThresholds?.[operation]) {
      const opThresh = operationThresholds[operation];
      if (opThresh?.wasm !== undefined) wasmThresh = opThresh.wasm;
      if (opThresh?.gpu !== undefined) gpuThresh = opThresh.gpu;
    }

    // Auto-select based on size thresholds
    if (elementCount >= gpuThresh && backendRegistry.has('gpu')) {
      const gpuBackend = backendRegistry.get('gpu');
      if (gpuBackend) return gpuBackend;
    }

    if (elementCount >= wasmThresh && backendRegistry.has('wasm')) {
      const wasmBackend = backendRegistry.get('wasm');
      if (wasmBackend) return wasmBackend;
    }

    // Fall back to JS backend
    return jsBackend;
  }

  /**
   * Execute an operation with automatic backend selection
   */
  private executeWithFallback<T>(
    operation: () => T,
    fallback: () => T
  ): T {
    if (!this.hints.fallbackOnError) {
      return operation();
    }

    try {
      return operation();
    } catch (error) {
      console.warn('Backend operation failed, falling back to JS:', error);
      return fallback();
    }
  }

  // =========================================================================
  // Element-wise Operations
  // =========================================================================

  /**
   * Matrix addition with auto backend selection
   */
  add(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const backend = this.selectBackend(a.length, 'add');
    return this.executeWithFallback(
      () => backend.add(a, b),
      () => jsBackend.add(a, b)
    );
  }

  /**
   * Matrix subtraction with auto backend selection
   */
  subtract(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const backend = this.selectBackend(a.length, 'subtract');
    return this.executeWithFallback(
      () => backend.subtract(a, b),
      () => jsBackend.subtract(a, b)
    );
  }

  /**
   * Element-wise multiplication with auto backend selection
   */
  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const backend = this.selectBackend(a.length, 'multiplyElementwise');
    return this.executeWithFallback(
      () => backend.multiplyElementwise(a, b),
      () => jsBackend.multiplyElementwise(a, b)
    );
  }

  /**
   * Element-wise division with auto backend selection
   */
  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const backend = this.selectBackend(a.length);
    return this.executeWithFallback(
      () => backend.divideElementwise(a, b),
      () => jsBackend.divideElementwise(a, b)
    );
  }

  /**
   * Scalar multiplication with auto backend selection
   */
  scale(a: DenseMatrix, scalar: number): DenseMatrix {
    const backend = this.selectBackend(a.length, 'scale');
    return this.executeWithFallback(
      () => backend.scale(a, scalar),
      () => jsBackend.scale(a, scalar)
    );
  }

  /**
   * Element-wise absolute value with auto backend selection
   */
  abs(a: DenseMatrix): DenseMatrix {
    const backend = this.selectBackend(a.length);
    return this.executeWithFallback(
      () => backend.abs(a),
      () => jsBackend.abs(a)
    );
  }

  /**
   * Element-wise negation with auto backend selection
   */
  negate(a: DenseMatrix): DenseMatrix {
    const backend = this.selectBackend(a.length);
    return this.executeWithFallback(
      () => backend.negate(a),
      () => jsBackend.negate(a)
    );
  }

  // =========================================================================
  // Matrix Operations
  // =========================================================================

  /**
   * Matrix multiplication with auto backend selection
   */
  multiply(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * b.cols * a.cols; // Approx operation count
    const backend = this.selectBackend(elementCount, 'multiply');
    return this.executeWithFallback(
      () => backend.multiply(a, b),
      () => jsBackend.multiply(a, b)
    );
  }

  /**
   * Matrix transpose with auto backend selection
   */
  transpose(a: DenseMatrix): DenseMatrix {
    const backend = this.selectBackend(a.length, 'transpose');
    return this.executeWithFallback(
      () => backend.transpose(a),
      () => jsBackend.transpose(a)
    );
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  /**
   * Sum of all elements with auto backend selection
   */
  async sum(a: DenseMatrix): Promise<number> {
    const backend = this.selectBackend(a.length);
    const result = backend.sum(a);
    return result instanceof Promise ? result : result;
  }

  /**
   * Sum along axis with auto backend selection
   */
  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix {
    const backend = this.selectBackend(a.length);
    return this.executeWithFallback(
      () => backend.sumAxis(a, axis),
      () => jsBackend.sumAxis(a, axis)
    );
  }

  /**
   * Frobenius norm with auto backend selection
   */
  norm(a: DenseMatrix): number {
    const backend = this.selectBackend(a.length);
    return this.executeWithFallback(
      () => backend.norm(a),
      () => jsBackend.norm(a)
    );
  }

  /**
   * Dot product with auto backend selection
   */
  async dot(a: DenseMatrix, b: DenseMatrix): Promise<number> {
    const backend = this.selectBackend(a.length);
    const result = backend.dot(a, b);
    return result instanceof Promise ? result : result;
  }

  // =========================================================================
  // Backend Info
  // =========================================================================

  /**
   * Get list of available backends
   */
  getAvailableBackends(): BackendType[] {
    return backendRegistry.available();
  }

  /**
   * Check if a specific backend is available
   */
  hasBackend(type: BackendType): boolean {
    return backendRegistry.has(type);
  }

  /**
   * Get current active backend for a given operation size
   */
  getActiveBackend(elementCount: number, operation?: OperationType): BackendType {
    return this.selectBackend(elementCount, operation).type;
  }

  /**
   * Force a specific backend for all operations
   */
  forceBackend(type: BackendType | null): void {
    if (type === null) {
      this.hints.preferredBackend = 'js';
    } else {
      this.hints.preferredBackend = type;
    }
  }
}

/**
 * Default backend manager instance
 */
export const backendManager = new BackendManager();

/**
 * Create a new backend manager with custom hints
 */
export function createBackendManager(hints?: ExtendedBackendHints): BackendManager {
  return new BackendManager(hints);
}
