# Rust WASM Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the migration of WASM operations from AssemblyScript (23KB, 202 exports) to Rust (648KB, 742 exports), making Rust the default WASM backend while keeping AS as a lightweight fallback.

**Architecture:** The Rust WASM binary at `wasm-rust/target/wasm32-unknown-unknown/release/mathts_wasm.wasm` already exists with 742 `#[no_mangle]` exports. The `RustWasmLoader` and `RustWASMBackend` are already integrated. This plan focuses on: (1) porting the 194 AS-only functions to Rust, (2) wiring all TS consumers to prefer Rust, (3) making Rust the default backend.

**Tech Stack:** Rust (wasm32-unknown-unknown target), cargo, wasm-opt, TypeScript wrappers

**Current State:**

- AS: 10 files, 3,324 lines, 202 exports, 23KB WASM
- Rust: 71 files, 21,933 lines, 742 exports, 648KB WASM
- `RustWasmLoader` + `RustWASMBackend` already integrated into BackendManager
- 50+ TS files reference AS `WasmLoader`/`wasmModule`

---

### Task 1: Audit AS→Rust function parity

**Files:**

- Read: `assembly/src/ops/scalar.ts`, `assembly/src/ops/array.ts`, `assembly/src/ops/matrix.ts`
- Read: `wasm-rust/crates/mathts-wasm/src/arithmetic/`, `wasm-rust/crates/mathts-wasm/src/matrix/`

- [ ] **Step 1: Generate parity matrix**

Run this Python script to map every AS export to its Rust equivalent (by function, not by name):

```python
# For each AS function, find the Rust function that does the same thing
# AS: add_f64(a, b) → Rust: arithmetic basic add(a, b) or similar
# AS: matrix_multiply(a, b, ...) → Rust: matrix multiply multiplyDense(a, b, ...)
```

- [ ] **Step 2: Identify gaps — AS functions with NO Rust equivalent**

Expected gaps: AS complex array ops, AS matrix utility functions, some scalar functions that Rust implements differently.

- [ ] **Step 3: Create parity report**

Write to `docs/roadmap/RUST_WASM_PARITY.md` — table of every AS export, its Rust equivalent (or "NEEDS PORT"), and status.

---

### Task 2: Port missing scalar and array functions to Rust

**Files:**

- Modify: `wasm-rust/crates/mathts-wasm/src/arithmetic/basic.rs`
- Modify: `wasm-rust/crates/mathts-wasm/src/arithmetic/advanced.rs`
- Create: `wasm-rust/crates/mathts-wasm/src/arithmetic/array.rs`

AS has 39 scalar functions (`add_f64`, `sin_f64`, etc.) and 41 array functions (`array_add`, `array_dot`, etc.) that Rust needs equivalents for.

- [ ] **Step 1: Add scalar functions matching AS signatures**

```rust
#[no_mangle]
pub unsafe extern "C" fn add_f64(a: f64, b: f64) -> f64 { a + b }

#[no_mangle]
pub unsafe extern "C" fn sin_f64(a: f64) -> f64 { a.sin() }
// ... etc for all 39
```

- [ ] **Step 2: Add array functions**

```rust
#[no_mangle]
pub unsafe extern "C" fn array_add(a_ptr: *const f64, b_ptr: *const f64, out_ptr: *mut f64, n: i32) {
    let n = n as usize;
    for i in 0..n {
        *out_ptr.add(i) = *a_ptr.add(i) + *b_ptr.add(i);
    }
}
// ... etc for all 41
```

- [ ] **Step 3: Build and verify**

```bash
cd wasm-rust && cargo build --target wasm32-unknown-unknown --release
node scripts/verify-exports.js
```

---

### Task 3: Port complex number operations to Rust

**Files:**

- Create: `wasm-rust/crates/mathts-wasm/src/complex/array.rs`
- Modify: `wasm-rust/crates/mathts-wasm/src/complex/operations.rs`

AS has 44 complex scalar ops and 33 complex array ops. Rust has some but not all.

- [ ] **Step 1: Port complex scalar ops not in Rust**
- [ ] **Step 2: Port complex array ops**
- [ ] **Step 3: Build and verify**

---

### Task 4: Port matrix operations to Rust

**Files:**

- Modify: `wasm-rust/crates/mathts-wasm/src/matrix/basic.rs`

AS has 41 matrix ops (multiply, transpose, trace, identity, etc.). Rust has the heavy ones (multiply, eigs, decompositions) but may miss utilities.

- [ ] **Step 1: Port matrix utility functions**

`matrix_identity`, `matrix_zeros`, `matrix_ones`, `matrix_fill`, `matrix_copy`, `matrix_diag`, `matrix_get_row`, `matrix_get_col`, `matrix_trace`, `matrix_transpose`, `matrix_is_symmetric`, etc.

- [ ] **Step 2: Build and verify**

---

### Task 5: Update WasmModule interface for Rust exports

**Files:**

- Modify: `matrix/src/backends/WasmLoader.ts` — add missing function signatures to `WasmModule` interface
- Modify: `matrix/src/backends/RustWasmLoader.ts` — update `RustWasmExports` interface

- [ ] **Step 1: Generate interface from Rust exports**

```bash
# List all #[no_mangle] pub extern "C" fn signatures
grep -rn '#\[no_mangle\]' wasm-rust/crates/mathts-wasm/src/ -A2 | grep 'pub.*fn'
```

- [ ] **Step 2: Update TypeScript interfaces to match**

---

### Task 6: Wire WASMBackend to prefer Rust

**Files:**

- Modify: `matrix/src/backends/WASMBackend.ts`
- Modify: `matrix/src/backends/BackendManager.ts`

- [ ] **Step 1: Add Rust WASM fallback chain**

In `WASMBackend`, try Rust first, fall back to AS, then JS:

```typescript
if (rustWasmLoader.isLoaded) {
  return this.executeRust(op, args);
} else if (this.wasmModule) {
  return this.executeAS(op, args);
} else {
  return this.executeJS(op, args);
}
```

- [ ] **Step 2: Update BackendManager thresholds**

Rust WASM is larger (648KB) but faster. Adjust thresholds:

- Small ops (<100 elements): JS (no WASM overhead)
- Medium ops (100-1K): AS WASM (23KB, fast load)
- Large ops (>1K): Rust WASM (if loaded) or AS WASM
- Heavy ops (FFT, eig, SVD): Rust WASM always (if loaded)

---

### Task 7: Make Rust the default WASM backend

**Files:**

- Modify: `assembly/package.json` — change build to copy Rust output
- Create: `wasm-rust/scripts/build-for-mathts.sh`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create build script that produces both binaries**

```bash
#!/bin/bash
# Build Rust WASM
cd wasm-rust && cargo build --target wasm32-unknown-unknown --release
# Optimize
wasm-opt -O3 target/wasm32-unknown-unknown/release/mathts_wasm.wasm -o ../lib/wasm/mathts.wasm
# Also build AS (for fallback/benchmarking)
cd ../assembly && npm run build
```

- [ ] **Step 2: Update package.json build scripts**

- [ ] **Step 3: Update CLAUDE.md and docs**

---

### Task 8: Benchmark Rust vs AS vs JS

**Files:**

- Create: `tests/benchmark/wasm-comparison.test.ts`

- [ ] **Step 1: Create benchmark comparing all 3 backends**

```typescript
describe('WASM Backend Comparison', () => {
  const sizes = [100, 1000, 10000];
  for (const n of sizes) {
    it(`matrix multiply ${n}x${n}: JS vs AS vs Rust`, async () => {
      // Time each backend
    });
    it(`FFT ${n} elements: JS vs AS vs Rust`, async () => {});
    it(`eigendecomposition ${n}x${n}: JS vs Rust`, async () => {});
  }
});
```

- [ ] **Step 2: Run benchmarks and document results**

---

### Task 9: Final verification

- [ ] All existing tests pass with Rust as default backend
- [ ] AS still works as fallback
- [ ] JS fallback works when no WASM available
- [ ] Build pipeline produces both binaries
- [ ] Bundle size documented
- [ ] CHANGELOG updated
