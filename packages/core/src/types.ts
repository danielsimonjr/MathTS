/**
 * Core type definitions for MathTS
 */

/**
 * Available computation backends
 */
export type BackendType = 'js' | 'wasm' | 'gpu';

/**
 * Supported numeric types
 */
export type NumericType = 'float32' | 'float64' | 'int32' | 'int64' | 'complex64' | 'complex128';

/**
 * MathTS configuration options
 */
export interface MathTSConfig {
  /** Preferred computation backend */
  backend: BackendType;
  /** Default numeric precision */
  precision: NumericType;
  /** Enable automatic backend selection based on input size */
  autoBackend: boolean;
  /** Threshold for switching to WASM backend (element count) */
  wasmThreshold: number;
  /** Threshold for switching to GPU backend (element count) */
  gpuThreshold: number;
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Complex number representation
 */
export interface ComplexNumber {
  re: number;
  im: number;
}

/**
 * Matrix dimensions
 */
export interface MatrixDimensions {
  rows: number;
  cols: number;
}
