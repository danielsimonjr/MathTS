/**
 * Backend management for matrix operations
 */

import type { BackendType, MathTSConfig } from '@mathts/core';

/**
 * Backend interface for matrix operations
 */
export interface Backend {
  name: BackendType;
  isAvailable(): boolean;
  matmul(a: Float64Array, b: Float64Array, m: number, n: number, k: number): Float64Array;
}

/**
 * JavaScript (pure TypeScript) backend
 */
const jsBackend: Backend = {
  name: 'js',
  isAvailable: () => true,
  matmul: (a, b, m, n, k) => {
    const result = new Float64Array(m * n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let l = 0; l < k; l++) {
          sum += a[i * k + l] * b[l * n + j];
        }
        result[i * n + j] = sum;
      }
    }
    return result;
  },
};

/**
 * Backend manager
 */
class BackendManager {
  private current: Backend = jsBackend;
  private config: Partial<MathTSConfig> = {};

  /**
   * Configure backend preferences
   */
  configure(config: Partial<MathTSConfig>): void {
    this.config = { ...this.config, ...config };
    // TODO: Switch backend based on config.backend
  }

  /**
   * Get the current backend
   */
  getCurrent(): Backend {
    return this.current;
  }

  /**
   * Select optimal backend based on operation size
   */
  selectForSize(elementCount: number): Backend {
    const { wasmThreshold = 1000, gpuThreshold = 100000 } = this.config;

    if (elementCount >= gpuThreshold) {
      // TODO: Return GPU backend if available
      return jsBackend;
    }
    if (elementCount >= wasmThreshold) {
      // TODO: Return WASM backend if available
      return jsBackend;
    }
    return jsBackend;
  }
}

/**
 * Global backend manager instance
 */
export const backends = new BackendManager();
