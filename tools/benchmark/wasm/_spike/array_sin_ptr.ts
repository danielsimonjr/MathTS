// THROWAWAY Phase-1 spike kernel (Task 1.2).
//
// A pointer-ABI AssemblyScript kernel that mirrors the Rust `simd_sin_array`
// flat-memory ABI (inPtr, outPtr, n) using raw `load<f64>` / `store<f64>`.
// The point is to let the EXISTING lean zero-per-call-alloc elementwise bridge
// (functions/src/wasm/elementwise/wasm-bridge.ts) drive an AS kernel unchanged,
// so we can isolate how much the AS managed-array (`__new` header) per-call
// allocation costs on the hot path.
//
// NOT production code. Compiled to array_sin_ptr.wasm via npx asc (see
// rust-vs-as-abi.spike.mts header for the exact invocation).

// in/out are byte offsets into linear memory; n is the element count.
export function array_sin_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3; // 8 bytes per f64
    store<f64>(outPtr + off, Math.sin(load<f64>(inPtr + off)));
  }
}
