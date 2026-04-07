/**
 * Matrix Backend Interface
 *
 * Defines the contract for matrix operation backends.
 * Implementations include JSBackend (pure TypeScript),
 * WASMBackend (AssemblyScript), and GPUBackend (WebGPU).
 *
 * @packageDocumentation
 */

import { DenseMatrix } from '../types/DenseMatrix.js';

/**
 * Backend type identifier
 */
export type BackendType = 'js' | 'wasm' | 'rust-wasm' | 'gpu' | 'parallel';

/**
 * Backend selection hints
 */
export interface BackendHints {
  /** Minimum size to use WASM backend */
  wasmThreshold?: number;
  /** Minimum size to use GPU backend */
  gpuThreshold?: number;
  /** Force a specific backend */
  preferredBackend?: BackendType;
}

/**
 * Default backend hints
 */
export const DEFAULT_BACKEND_HINTS: Required<BackendHints> = {
  wasmThreshold: 1000,     // > 1000 elements
  gpuThreshold: 100000,    // > 100K elements
  preferredBackend: 'js',
};

/**
 * Abstract backend interface for matrix operations
 *
 * Each backend implements the same operations but may use different
 * underlying implementations (pure JS, WASM SIMD, WebGPU compute shaders).
 */
export interface MatrixBackend {
  /**
   * Backend identifier
   */
  readonly type: BackendType;

  /**
   * Whether the backend is available in the current environment
   */
  isAvailable(): boolean;

  /**
   * Initialize the backend (may be async for WASM/GPU)
   */
  initialize(): Promise<void>;

  // =========================================================================
  // Element-wise Operations
  // =========================================================================

  /**
   * Matrix addition: C = A + B
   */
  add(a: DenseMatrix, b: DenseMatrix): DenseMatrix;

  /**
   * Matrix subtraction: C = A - B
   */
  subtract(a: DenseMatrix, b: DenseMatrix): DenseMatrix;

  /**
   * Element-wise multiplication: C = A .* B
   */
  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix;

  /**
   * Element-wise division: C = A ./ B
   */
  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix;

  /**
   * Scalar multiplication: C = A * s
   */
  scale(a: DenseMatrix, scalar: number): DenseMatrix;

  /**
   * Element-wise absolute value
   */
  abs(a: DenseMatrix): DenseMatrix;

  /**
   * Element-wise negation
   */
  negate(a: DenseMatrix): DenseMatrix;

  // =========================================================================
  // Matrix Operations
  // =========================================================================

  /**
   * Matrix multiplication: C = A * B
   */
  multiply(a: DenseMatrix, b: DenseMatrix): DenseMatrix;

  /**
   * Matrix transpose
   */
  transpose(a: DenseMatrix): DenseMatrix;

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  /**
   * Sum of all elements (may be async for parallel backends)
   */
  sum(a: DenseMatrix): number | Promise<number>;

  /**
   * Sum along an axis (0 = columns, 1 = rows)
   */
  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix;

  /**
   * Frobenius norm
   */
  norm(a: DenseMatrix): number;

  /**
   * Dot product of two vectors (may be async for parallel backends)
   */
  dot(a: DenseMatrix, b: DenseMatrix): number | Promise<number>;
}

/**
 * Registry of available backends
 */
export class BackendRegistry {
  private backends: Map<BackendType, MatrixBackend> = new Map();
  private initialized: Set<BackendType> = new Set();
  private hints: Required<BackendHints> = { ...DEFAULT_BACKEND_HINTS };

  /**
   * Register a backend
   */
  register(backend: MatrixBackend): void {
    this.backends.set(backend.type, backend);
  }

  /**
   * Get a backend by type
   */
  get(type: BackendType): MatrixBackend | undefined {
    return this.backends.get(type);
  }

  /**
   * Check if a backend is registered and available
   */
  has(type: BackendType): boolean {
    const backend = this.backends.get(type);
    return backend !== undefined && backend.isAvailable();
  }

  /**
   * Initialize a backend
   */
  async initialize(type: BackendType): Promise<void> {
    if (this.initialized.has(type)) return;

    const backend = this.backends.get(type);
    if (!backend) {
      throw new Error(`Backend not registered: ${type}`);
    }

    await backend.initialize();
    this.initialized.add(type);
  }

  /**
   * Get all available backends
   */
  available(): BackendType[] {
    return Array.from(this.backends.entries())
      .filter(([, backend]) => backend.isAvailable())
      .map(([type]) => type);
  }

  /**
   * Update selection hints
   */
  setHints(hints: BackendHints): void {
    this.hints = { ...this.hints, ...hints };
  }

  /**
   * Get current hints
   */
  getHints(): Required<BackendHints> {
    return { ...this.hints };
  }

  /**
   * Select the best backend for a given operation size
   */
  selectBackend(elementCount: number): MatrixBackend {
    const { wasmThreshold, gpuThreshold, preferredBackend } = this.hints;

    // Check preferred backend first
    if (preferredBackend !== 'js' && this.has(preferredBackend)) {
      const backend = this.backends.get(preferredBackend);
      if (backend && this.initialized.has(preferredBackend)) {
        return backend;
      }
    }

    // Auto-select based on size thresholds
    if (elementCount >= gpuThreshold && this.has('gpu') && this.initialized.has('gpu')) {
      return this.backends.get('gpu')!;
    }

    if (elementCount >= wasmThreshold && this.has('wasm') && this.initialized.has('wasm')) {
      return this.backends.get('wasm')!;
    }

    // Fall back to JS backend
    const jsBackend = this.backends.get('js');
    if (!jsBackend) {
      throw new Error('No backend available');
    }
    return jsBackend;
  }
}

/**
 * Global backend registry
 */
export const backendRegistry = new BackendRegistry();
