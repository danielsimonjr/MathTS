/**
 * MathTS Matrix Configuration
 *
 * Centralized configuration for matrix operations, backend selection,
 * and performance tuning.
 *
 * @packageDocumentation
 */

import type { BackendType } from './backends/Backend.js';

/**
 * Operation type hints for backend selection.
 *
 * Defined here rather than in `BackendManager.ts` so that `config.ts` (the
 * lower-level module) owns it — `BackendManager` already imports `config`, so
 * sourcing the type the other way round closed an import cycle.
 */
export type OperationType =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'multiplyElementwise'
  | 'transpose'
  | 'scale'
  | 'decomposition'
  | 'solve'
  | 'fft'
  | 'eig'
  | 'svd';

/**
 * Backend preference level
 */
export type BackendPreference = 'auto' | 'prefer' | 'require' | 'disable';

/**
 * Backend-specific configuration
 */
export interface BackendConfig {
  /** Enable this backend */
  enabled: boolean;
  /** Preference level */
  preference: BackendPreference;
  /** Minimum elements to trigger this backend */
  threshold: number;
  /** Operation-specific thresholds */
  operationThresholds?: Partial<Record<OperationType, number>>;
}

/**
 * Adaptive tuning configuration
 */
export interface AdaptiveTuningConfig {
  /** Enable adaptive threshold tuning */
  enabled: boolean;
  /** Number of samples to collect before adjusting */
  sampleSize: number;
  /** Minimum speedup ratio to switch backends */
  minSpeedupRatio: number;
  /** Maximum adjustment per iteration (percentage) */
  maxAdjustmentPercent: number;
  /** Cooldown period between adjustments (ms) */
  cooldownMs: number;
}

/**
 * Profiling configuration
 */
export interface ProfilingConfig {
  /** Enable performance profiling */
  enabled: boolean;
  /** Log slow operations (threshold in ms) */
  slowOperationThresholdMs: number;
  /** Collect statistics */
  collectStats: boolean;
}

/**
 * Matrix library configuration
 */
export interface MatrixConfig {
  /** Backend configurations */
  backends: {
    js: BackendConfig;
    wasm: BackendConfig;
    gpu: BackendConfig;
  };
  /** Adaptive tuning settings */
  adaptiveTuning: AdaptiveTuningConfig;
  /** Profiling settings */
  profiling: ProfilingConfig;
  /** Default numeric precision */
  precision: 'single' | 'double';
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: MatrixConfig = {
  backends: {
    js: {
      enabled: true,
      preference: 'auto',
      threshold: 0, // Always available
      operationThresholds: {},
    },
    wasm: {
      enabled: true,
      preference: 'auto',
      threshold: 1000, // >1000 elements
      operationThresholds: {
        multiply: 500,
        decomposition: 100,
        transpose: 2000,
      },
    },
    gpu: {
      enabled: true,
      preference: 'auto',
      threshold: 100000, // >100K elements
      operationThresholds: {
        multiply: 50000,
        decomposition: 10000,
        transpose: 200000,
      },
    },
  },
  adaptiveTuning: {
    enabled: true,
    sampleSize: 10,
    minSpeedupRatio: 1.2, // 20% improvement to switch
    maxAdjustmentPercent: 25,
    cooldownMs: 5000,
  },
  profiling: {
    enabled: false,
    slowOperationThresholdMs: 100,
    collectStats: false,
  },
  precision: 'double',
  debug: false,
};

/**
 * Current configuration (mutable)
 */
let currentConfig: MatrixConfig = { ...DEFAULT_CONFIG };

/**
 * Configuration change listeners
 */
type ConfigListener = (config: MatrixConfig) => void;
const listeners: Set<ConfigListener> = new Set();

/**
 * Get current configuration
 */
export function getConfig(): Readonly<MatrixConfig> {
  return currentConfig;
}

/**
 * Update configuration
 */
export function setConfig(config: Partial<MatrixConfig>): void {
  currentConfig = mergeConfig(currentConfig, config);
  notifyListeners();
}

/**
 * Reset to default configuration
 */
export function resetConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
  notifyListeners();
}

/**
 * Subscribe to configuration changes
 */
export function onConfigChange(listener: ConfigListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify all listeners
 */
function notifyListeners(): void {
  for (const listener of listeners) {
    try {
      listener(currentConfig);
    } catch (error) {
      console.error('Config listener error:', error);
    }
  }
}

/**
 * Deep merge configuration objects
 */
function mergeConfig(base: MatrixConfig, override: Partial<MatrixConfig>): MatrixConfig {
  const result = { ...base };

  if (override.backends) {
    result.backends = {
      js: { ...base.backends.js, ...override.backends.js },
      wasm: { ...base.backends.wasm, ...override.backends.wasm },
      gpu: { ...base.backends.gpu, ...override.backends.gpu },
    };
  }

  if (override.adaptiveTuning) {
    result.adaptiveTuning = { ...base.adaptiveTuning, ...override.adaptiveTuning };
  }

  if (override.profiling) {
    result.profiling = { ...base.profiling, ...override.profiling };
  }

  if (override.precision !== undefined) {
    result.precision = override.precision;
  }

  if (override.debug !== undefined) {
    result.debug = override.debug;
  }

  return result;
}

// =========================================================================
// Backend Preference API
// =========================================================================

/**
 * Set backend preference
 */
export function setBackendPreference(
  backend: BackendType,
  preference: BackendPreference
): void {
  if (backend === 'parallel') return; // Not configurable

  setConfig({
    backends: {
      ...currentConfig.backends,
      [backend]: {
        ...currentConfig.backends[backend as keyof typeof currentConfig.backends],
        preference,
      },
    },
  });
}

/**
 * Set backend threshold
 */
export function setBackendThreshold(
  backend: BackendType,
  threshold: number
): void {
  if (backend === 'parallel') return;

  setConfig({
    backends: {
      ...currentConfig.backends,
      [backend]: {
        ...currentConfig.backends[backend as keyof typeof currentConfig.backends],
        threshold,
      },
    },
  });
}

/**
 * Enable or disable a backend
 */
export function setBackendEnabled(
  backend: BackendType,
  enabled: boolean
): void {
  if (backend === 'parallel' || backend === 'js') return; // Always enabled

  setConfig({
    backends: {
      ...currentConfig.backends,
      [backend]: {
        ...currentConfig.backends[backend as keyof typeof currentConfig.backends],
        enabled,
      },
    },
  });
}

/**
 * Get recommended backend for given operation and size
 */
export function getRecommendedBackend(
  elementCount: number,
  operation?: OperationType
): BackendType {
  const { backends } = currentConfig;

  // Check GPU first (highest priority for large data)
  if (backends.gpu.enabled && backends.gpu.preference !== 'disable') {
    const threshold = operation && backends.gpu.operationThresholds?.[operation]
      ? backends.gpu.operationThresholds[operation]!
      : backends.gpu.threshold;

    if (elementCount >= threshold) {
      return 'gpu';
    }
  }

  // Check WASM
  if (backends.wasm.enabled && backends.wasm.preference !== 'disable') {
    const threshold = operation && backends.wasm.operationThresholds?.[operation]
      ? backends.wasm.operationThresholds[operation]!
      : backends.wasm.threshold;

    if (elementCount >= threshold) {
      return 'wasm';
    }
  }

  // Fall back to JS
  return 'js';
}

/**
 * Force a specific backend for all operations
 */
export function forceBackend(backend: BackendType | null): void {
  if (backend === null) {
    // Reset all preferences to auto
    setConfig({
      backends: {
        js: { ...currentConfig.backends.js, preference: 'auto' },
        wasm: { ...currentConfig.backends.wasm, preference: 'auto' },
        gpu: { ...currentConfig.backends.gpu, preference: 'auto' },
      },
    });
  } else if (backend !== 'parallel') {
    // Set the specified backend to 'require' and disable others
    setConfig({
      backends: {
        js: {
          ...currentConfig.backends.js,
          preference: backend === 'js' ? 'require' : 'disable',
        },
        wasm: {
          ...currentConfig.backends.wasm,
          preference: backend === 'wasm' ? 'require' : 'disable',
        },
        gpu: {
          ...currentConfig.backends.gpu,
          preference: backend === 'gpu' ? 'require' : 'disable',
        },
      },
    });
  }
}

// =========================================================================
// Profiling API
// =========================================================================

/**
 * Enable profiling
 */
export function enableProfiling(collectStats: boolean = true): void {
  setConfig({
    profiling: {
      ...currentConfig.profiling,
      enabled: true,
      collectStats,
    },
  });
}

/**
 * Disable profiling
 */
export function disableProfiling(): void {
  setConfig({
    profiling: {
      ...currentConfig.profiling,
      enabled: false,
    },
  });
}

// =========================================================================
// Adaptive Tuning API
// =========================================================================

/**
 * Enable adaptive tuning
 */
export function enableAdaptiveTuning(): void {
  setConfig({
    adaptiveTuning: {
      ...currentConfig.adaptiveTuning,
      enabled: true,
    },
  });
}

/**
 * Disable adaptive tuning
 */
export function disableAdaptiveTuning(): void {
  setConfig({
    adaptiveTuning: {
      ...currentConfig.adaptiveTuning,
      enabled: false,
    },
  });
}

/**
 * Configure adaptive tuning parameters
 */
export function configureAdaptiveTuning(config: Partial<AdaptiveTuningConfig>): void {
  setConfig({
    adaptiveTuning: {
      ...currentConfig.adaptiveTuning,
      ...config,
    },
  });
}
