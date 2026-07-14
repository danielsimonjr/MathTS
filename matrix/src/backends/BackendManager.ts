/**
 * Backend Manager
 *
 * Centralized management for matrix operation backends with automatic
 * selection based on matrix size, operation type, and availability.
 * Includes adaptive threshold tuning based on runtime profiling.
 *
 * @packageDocumentation
 */

import { GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';
import { DenseMatrix } from '../types/DenseMatrix.js';
import type { MatrixBackend, BackendType, BackendHints } from './Backend.js';
import { backendRegistry, DEFAULT_BACKEND_HINTS } from './Backend.js';
import { jsBackend } from './JSBackend.js';
import { getConfig, onConfigChange, type MatrixConfig, type OperationType } from '../config.js';
// Side-effect import: makes sure JS / AS-WASM backends are
// registered in `backendRegistry` even when consumers import this module
// without first touching `./index.ts`. Cheap (no WASM load until init()).
import './register-backends.js';

// `OperationType` is defined in `config.ts` (to break the config/BackendManager
// import cycle); re-exported here so existing `./BackendManager.js` importers
// keep resolving it.
export type { OperationType };

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
    // matmul: the SIMD-WASM kernel wins from ~256 elems (16²), solidly 1.3–2.2× (measured,
    // tools/benchmarks/matmul-threshold.mjs); below that copy/alloc overhead dominates (8²
    // loses, 12² marginal). Dropped 500→256 to stop forcing 16²–22² matmuls onto JS.
    // ⚠️ Every `gpu:` threshold below is DORMANT — `selectBackend` gates the GPU
    // branch on `backendRegistry.has('gpu')`, and no 'gpu' backend is ever
    // registered (register-backends.ts registers js + wasm only). They are aligned
    // to the single canonical GPU_MIN_ELEMENTS rather than left as four divergent
    // magic numbers (50_000 / 10_000 / 200_000 against a live 65_536), which would
    // mislead whoever wires this route up. GPU matrix work currently reaches the
    // device via `gpuMatmul` -> `gpuMatrixBackend`, not through this manager.
    multiply: { wasm: 256, gpu: GPU_MIN_ELEMENTS },
    decomposition: { wasm: 100, gpu: GPU_MIN_ELEMENTS },
    // transpose WASM is retired (memory-bound, lost 4–6×) — WASMBackend.transpose always uses
    // JS regardless of this gate; kept high so the manager doesn't even select the WASM backend.
    transpose: { wasm: 2000, gpu: GPU_MIN_ELEMENTS },
  },
  autoSIMD: true,
  fallbackOnError: true,
};

/**
 * Performance sample for adaptive tuning
 */
interface PerformanceSample {
  operation: OperationType;
  elementCount: number;
  backend: BackendType;
  durationMs: number;
  timestamp: number;
}

/**
 * Adaptive threshold state
 */
interface AdaptiveThresholdState {
  samples: PerformanceSample[];
  lastAdjustment: number;
  adjustedThresholds: Map<OperationType, { wasm: number; gpu: number }>;
}

/**
 * Centralized Backend Manager
 *
 * Provides a unified interface for executing matrix operations with
 * automatic backend selection based on matrix size and operation type.
 * Features adaptive threshold tuning based on runtime profiling.
 */
export class BackendManager {
  private hints: Required<ExtendedBackendHints>;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private adaptiveState: AdaptiveThresholdState;
  private configUnsubscribe: (() => void) | null = null;

  constructor(hints: ExtendedBackendHints = {}) {
    this.hints = { ...DEFAULT_EXTENDED_HINTS, ...hints };
    this.adaptiveState = {
      samples: [],
      lastAdjustment: 0,
      adjustedThresholds: new Map(),
    };

    // Subscribe to config changes
    this.configUnsubscribe = onConfigChange((config) => {
      this.syncWithConfig(config);
    });
  }

  /**
   * Sync manager state with global config
   */
  private syncWithConfig(config: MatrixConfig): void {
    const { backends } = config;

    // Update thresholds from config
    this.hints.wasmThreshold = backends.wasm.threshold;
    this.hints.gpuThreshold = backends.gpu.threshold;

    // Update operation thresholds
    if (backends.wasm.operationThresholds || backends.gpu.operationThresholds) {
      const opThresholds: Partial<Record<OperationType, { wasm?: number; gpu?: number }>> = {};

      for (const op of ['multiply', 'decomposition', 'transpose'] as OperationType[]) {
        opThresholds[op] = {
          wasm: backends.wasm.operationThresholds?.[op] ?? this.hints.wasmThreshold,
          gpu: backends.gpu.operationThresholds?.[op] ?? this.hints.gpuThreshold,
        };
      }

      this.hints.operationThresholds = opThresholds;
    }
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
   * Get the best backend for a given operation and matrix size.
   *
   * Selection priority:
   *   1. Preferred backend (if explicitly set)
   *   2. Elements > gpuThreshold -> GPU (if available)
   *   3. Elements > wasmThreshold -> AS WASM (if loaded)
   *   4. JS fallback
   */
  selectBackend(elementCount: number, operation?: OperationType): MatrixBackend {
    const { preferredBackend, operationThresholds, wasmThreshold, gpuThreshold } = this.hints;

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
  private executeWithFallback<T>(operation: () => T, fallback: () => T): T {
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

  // =========================================================================
  // Adaptive Threshold Tuning
  // =========================================================================

  /**
   * Record a performance sample for adaptive tuning
   */
  recordSample(
    operation: OperationType,
    elementCount: number,
    backend: BackendType,
    durationMs: number
  ): void {
    const config = getConfig();
    if (!config.adaptiveTuning.enabled) return;

    this.adaptiveState.samples.push({
      operation,
      elementCount,
      backend,
      durationMs,
      timestamp: Date.now(),
    });

    // Limit sample size
    const maxSamples = config.adaptiveTuning.sampleSize * 10;
    if (this.adaptiveState.samples.length > maxSamples) {
      this.adaptiveState.samples = this.adaptiveState.samples.slice(-maxSamples);
    }

    // Check if we should adjust thresholds
    this.maybeAdjustThresholds();
  }

  /**
   * Adjust thresholds based on collected samples
   */
  private maybeAdjustThresholds(): void {
    const config = getConfig();
    if (!config.adaptiveTuning.enabled) return;

    const now = Date.now();
    const { cooldownMs, sampleSize, minSpeedupRatio, maxAdjustmentPercent } = config.adaptiveTuning;

    // Check cooldown
    if (now - this.adaptiveState.lastAdjustment < cooldownMs) {
      return;
    }

    // Group samples by operation
    const operationSamples = new Map<OperationType, PerformanceSample[]>();
    for (const sample of this.adaptiveState.samples) {
      const existing = operationSamples.get(sample.operation) ?? [];
      existing.push(sample);
      operationSamples.set(sample.operation, existing);
    }

    // Analyze each operation
    for (const [operation, samples] of operationSamples) {
      if (samples.length < sampleSize) continue;

      // Group by backend
      const byBackend = new Map<BackendType, PerformanceSample[]>();
      for (const s of samples) {
        const existing = byBackend.get(s.backend) ?? [];
        existing.push(s);
        byBackend.set(s.backend, existing);
      }

      // Calculate average throughput (elements/ms) for each backend
      const throughput = new Map<BackendType, number>();
      for (const [backend, backendSamples] of byBackend) {
        const totalElements = backendSamples.reduce((s, x) => s + x.elementCount, 0);
        const totalTime = backendSamples.reduce((s, x) => s + x.durationMs, 0);
        if (totalTime > 0) {
          throughput.set(backend, totalElements / totalTime);
        }
      }

      // Find crossover points where faster backend becomes better
      const jsThroughput = throughput.get('js') ?? 0;
      const wasmThroughput = throughput.get('wasm') ?? 0;
      const gpuThroughput = throughput.get('gpu') ?? 0;

      const currentThresholds = this.adaptiveState.adjustedThresholds.get(operation) ?? {
        wasm: this.hints.operationThresholds?.[operation]?.wasm ?? this.hints.wasmThreshold,
        gpu: this.hints.operationThresholds?.[operation]?.gpu ?? this.hints.gpuThreshold,
      };

      let newWasmThreshold = currentThresholds.wasm;
      let newGpuThreshold = currentThresholds.gpu;

      // Adjust WASM threshold
      if (wasmThroughput > jsThroughput * minSpeedupRatio) {
        // WASM is significantly faster - lower threshold
        const adjustment = currentThresholds.wasm * (maxAdjustmentPercent / 100);
        newWasmThreshold = Math.max(100, currentThresholds.wasm - adjustment);
      } else if (jsThroughput > wasmThroughput * minSpeedupRatio) {
        // JS is faster - raise threshold
        const adjustment = currentThresholds.wasm * (maxAdjustmentPercent / 100);
        newWasmThreshold = currentThresholds.wasm + adjustment;
      }

      // Adjust GPU threshold
      if (gpuThroughput > wasmThroughput * minSpeedupRatio) {
        // GPU is significantly faster - lower threshold
        const adjustment = currentThresholds.gpu * (maxAdjustmentPercent / 100);
        newGpuThreshold = Math.max(1000, currentThresholds.gpu - adjustment);
      } else if (wasmThroughput > gpuThroughput * minSpeedupRatio) {
        // WASM is faster - raise GPU threshold
        const adjustment = currentThresholds.gpu * (maxAdjustmentPercent / 100);
        newGpuThreshold = currentThresholds.gpu + adjustment;
      }

      // Update adjusted thresholds
      this.adaptiveState.adjustedThresholds.set(operation, {
        wasm: Math.round(newWasmThreshold),
        gpu: Math.round(newGpuThreshold),
      });
    }

    this.adaptiveState.lastAdjustment = now;
  }

  /**
   * Get current adaptive thresholds
   */
  getAdaptiveThresholds(): Map<OperationType, { wasm: number; gpu: number }> {
    return new Map(this.adaptiveState.adjustedThresholds);
  }

  /**
   * Reset adaptive tuning state
   */
  resetAdaptiveState(): void {
    this.adaptiveState = {
      samples: [],
      lastAdjustment: 0,
      adjustedThresholds: new Map(),
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    sampleCount: number;
    operationStats: Map<
      OperationType,
      {
        avgDuration: number;
        samples: number;
        backendUsage: Record<BackendType, number>;
      }
    >;
  } {
    const operationStats = new Map<
      OperationType,
      {
        avgDuration: number;
        samples: number;
        backendUsage: Record<BackendType, number>;
      }
    >();

    // Group by operation
    const byOperation = new Map<OperationType, PerformanceSample[]>();
    for (const sample of this.adaptiveState.samples) {
      const existing = byOperation.get(sample.operation) ?? [];
      existing.push(sample);
      byOperation.set(sample.operation, existing);
    }

    for (const [op, samples] of byOperation) {
      const avgDuration = samples.reduce((s, x) => s + x.durationMs, 0) / samples.length;

      const backendUsage: Record<BackendType, number> = {
        js: 0,
        wasm: 0,
        gpu: 0,
        parallel: 0,
      };

      for (const s of samples) {
        backendUsage[s.backend]++;
      }

      operationStats.set(op, {
        avgDuration,
        samples: samples.length,
        backendUsage,
      });
    }

    return {
      sampleCount: this.adaptiveState.samples.length,
      operationStats,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.configUnsubscribe) {
      this.configUnsubscribe();
      this.configUnsubscribe = null;
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
