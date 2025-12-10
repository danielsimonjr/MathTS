/**
 * @mathts/core - Core types and utilities for MathTS
 * @packageDocumentation
 */

// Type definitions
export type { MathTSConfig, BackendType, NumericType } from './types';

// Configuration
export { createConfig, defaultConfig } from './config';

// Utilities
export { isNumeric, isComplex, isMatrix } from './utils';

// Version
export const VERSION = '0.1.0';
