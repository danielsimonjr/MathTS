/**
 * MathTS WASM Bindings
 *
 * High-level TypeScript interface for the MathTS WASM module.
 * Handles memory management and provides a clean API.
 */

export { MathTSWasm, loadWasm, loadWasmSync } from './wasm-loader.js';
export type { MathTSWasmExports, MathTSWasmInstance } from './wasm-loader.js';
