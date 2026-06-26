/**
 * Unary elementwise transcendental array kernels — POINTER-ABI AssemblyScript.
 *
 * Hybrid-ABI decision (docs/roadmap/RUST_TO_AS_MIGRATION_PHASE1.md): the hot
 * elementwise/fusion path uses a flat-memory pointer ABI that mirrors the Rust
 * `simd_<op>_array(inPtr, outPtr, n)` signature, so the existing lean
 * zero-per-call-alloc bridge (functions/src/wasm/elementwise/wasm-bridge.ts) can
 * drive these AS kernels unchanged. Managed-array (`__new` header) per-call
 * allocation regresses the hot path (1.39× Rust at 131k); the pointer ABI stays
 * at 0.82–1.16× Rust (Phase-1 spike, _spike/array_sin_ptr.ts — promoted here).
 *
 * `inPtr` / `outPtr` are byte offsets into linear memory; `n` is the element
 * count. Each kernel is an out-of-place scalar loop: `out[i] = f(in[i])`.
 *
 * Covers all 18 ops in WASM_ELEMENTWISE_OPS:
 *   abs sin cos tan exp log atan sinh tanh atanh expm1 log1p log2 log10
 *   sec csc cot erfc
 *
 * For abs/sin/cos/exp/log the math mirrors the managed `array_<op>` impls in
 * ops/array.ts exactly (bit-identical). For erfc the validated continued-fraction
 * scalar is ported from functions/src/typed/special.ts (`erfcScalar`), NOT the
 * cheap Abramowitz-&-Stegun rational (~1.5e-7) in functions/src/wasm/special.
 */

// ---------------------------------------------------------------------------
// erfc — validated continued-fraction scalar (port of typed/special.ts).
//
// _erfSeries: erf(|a|) by Maclaurin series (machine-accurate for a <~ 2).
// _erfcCF:    erfc(a>0) via A&S 7.1.14 continued fraction (modified Lentz);
//             computes the small tail DIRECTLY (no 1 - erf cancellation).
// _erfc:      x<0 reflection erfc(-x)=2-erfc(x); x<1.5 → 1-_erfSeries, else CF.
// ---------------------------------------------------------------------------

function _erfSeries(a: f64): f64 {
  const c: f64 = 2.0 / Math.sqrt(Math.PI);
  let sum: f64 = a;
  let term: f64 = a;
  for (let n: i32 = 1; n < 80; n++) {
    term *= (-a * a) / <f64>n;
    const inc: f64 = term / <f64>(2 * n + 1);
    sum += inc;
    if (Math.abs(inc) < Math.abs(sum) * 1e-17) break;
  }
  return c * sum;
}

function _erfcCF(a: f64): f64 {
  const tiny: f64 = 1e-300;
  let f: f64 = a < tiny ? tiny : a; // b_0 = a
  let C: f64 = f;
  let D: f64 = 0.0;
  for (let i: i32 = 1; i <= 300; i++) {
    const ai: f64 = <f64>i / 2.0; // partial numerator a_i = i/2
    D = a + ai * D;
    if (D == 0.0) D = tiny;
    D = 1.0 / D;
    C = a + ai / C;
    if (C == 0.0) C = tiny;
    const delta: f64 = C * D;
    f *= delta;
    if (Math.abs(delta - 1.0) < 1e-16) break;
  }
  return Math.exp(-a * a) / Math.sqrt(Math.PI) / f;
}

function _erfc(x: f64): f64 {
  if (!isFinite(x)) return x > 0.0 ? 0.0 : 2.0;
  if (x < 0.0) return 2.0 - _erfc(-x); // erfc(-x) = 2 - erfc(x)
  return x < 1.5 ? 1.0 - _erfSeries(x) : _erfcCF(x);
}

// ---------------------------------------------------------------------------
// Pointer-ABI kernels — array_<op>_ptr(inPtr, outPtr, n).
// ---------------------------------------------------------------------------

export function array_abs_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, abs(load<f64>(inPtr + off)));
  }
}

export function array_sin_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.sin(load<f64>(inPtr + off)));
  }
}

export function array_cos_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.cos(load<f64>(inPtr + off)));
  }
}

export function array_tan_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.tan(load<f64>(inPtr + off)));
  }
}

export function array_exp_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.exp(load<f64>(inPtr + off)));
  }
}

export function array_log_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.log(load<f64>(inPtr + off)));
  }
}

export function array_atan_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.atan(load<f64>(inPtr + off)));
  }
}

export function array_sinh_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.sinh(load<f64>(inPtr + off)));
  }
}

export function array_tanh_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.tanh(load<f64>(inPtr + off)));
  }
}

export function array_atanh_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.atanh(load<f64>(inPtr + off)));
  }
}

export function array_expm1_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.expm1(load<f64>(inPtr + off)));
  }
}

export function array_log1p_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.log1p(load<f64>(inPtr + off)));
  }
}

export function array_log2_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.log2(load<f64>(inPtr + off)));
  }
}

export function array_log10_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, Math.log10(load<f64>(inPtr + off)));
  }
}

export function array_sec_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, 1.0 / Math.cos(load<f64>(inPtr + off)));
  }
}

export function array_csc_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, 1.0 / Math.sin(load<f64>(inPtr + off)));
  }
}

export function array_cot_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, 1.0 / Math.tan(load<f64>(inPtr + off)));
  }
}

export function array_erfc_ptr(inPtr: usize, outPtr: usize, n: i32): void {
  for (let i = 0; i < n; i++) {
    const off = (<usize>i) << 3;
    store<f64>(outPtr + off, _erfc(load<f64>(inPtr + off)));
  }
}
