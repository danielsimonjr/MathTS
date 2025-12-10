/**
 * Configuration management for MathTS
 */

import type { MathTSConfig } from './types';

/**
 * Default configuration values
 */
export const defaultConfig: MathTSConfig = {
  backend: 'js',
  precision: 'float64',
  autoBackend: true,
  wasmThreshold: 1000,
  gpuThreshold: 100000,
  debug: false,
};

/**
 * Create a new configuration with optional overrides
 */
export function createConfig(overrides: Partial<MathTSConfig> = {}): MathTSConfig {
  return {
    ...defaultConfig,
    ...overrides,
  };
}
