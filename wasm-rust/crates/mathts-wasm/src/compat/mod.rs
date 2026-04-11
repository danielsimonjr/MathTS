//! AssemblyScript-compatible function names.
//!
//! These thin wrappers delegate to inline Rust implementations
//! but use the names the TypeScript `MathTSWasmExports` / `WasmModule`
//! interfaces expect (e.g. `add_f64`, `array_add`, etc.).
//!
//! **Do NOT modify existing Rust functions** -- this module only *adds*
//! new `#[no_mangle] extern "C"` symbols.

pub mod array;
pub mod complex;
pub mod matrix;
pub mod scalar;
pub mod simd_array;
