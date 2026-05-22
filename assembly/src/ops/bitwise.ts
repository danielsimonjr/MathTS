/**
 * Bitwise Operations for AssemblyScript
 *
 * High-performance elementwise bitwise operations on Int32Array buffers.
 * Mirrors the seven JS bitwise ops exposed by
 * `functions/src/typed/bitwise.ts` (bitAnd / bitOr / bitXor / bitNot /
 * leftShift / rightArithShift / rightLogShift).
 *
 * Calling convention follows the existing AS array ops (`ops/array.ts`):
 * pass high-level TypedArray references; the AS loader handles
 * marshaling. Each binary kernel takes (a, b, result); the unary takes
 * (a, result); the shift kernels also take per-element shift counts
 * stored in a parallel `Int32Array`.
 *
 * The legacy scalar bitwise primitives live in the Rust WASM crate
 * (`wasm-rust/crates/mathts-wasm/src/bitwise/operations.rs`); these
 * elementwise variants are what `functions/src/typed/bitwise.ts`
 * dispatches to for large `Int32Array` inputs when the AS backend is
 * selected via `MATHJS_WASM_BACKEND=assemblyscript`.
 */

/**
 * Element-wise bitwise AND: result = a & b
 */
export function bitAnd_i32_array(
  a: Int32Array,
  b: Int32Array,
  result: Int32Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) & unchecked(b[i])));
  }
}

/**
 * Element-wise bitwise OR: result = a | b
 */
export function bitOr_i32_array(
  a: Int32Array,
  b: Int32Array,
  result: Int32Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) | unchecked(b[i])));
  }
}

/**
 * Element-wise bitwise XOR: result = a ^ b
 */
export function bitXor_i32_array(
  a: Int32Array,
  b: Int32Array,
  result: Int32Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) ^ unchecked(b[i])));
  }
}

/**
 * Element-wise bitwise NOT: result = ~a
 */
export function bitNot_i32_array(a: Int32Array, result: Int32Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = ~unchecked(a[i])));
  }
}

/**
 * Element-wise left shift: result[i] = a[i] << (b[i] & 31)
 *
 * AssemblyScript's `<<` on `i32` masks the shift count modulo 32, which
 * matches JavaScript semantics on Int32Array members.
 */
export function leftShift_i32_array(
  a: Int32Array,
  b: Int32Array,
  result: Int32Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) << unchecked(b[i])));
  }
}

/**
 * Element-wise arithmetic (sign-preserving) right shift:
 *   result[i] = a[i] >> (b[i] & 31)
 */
export function rightArithShift_i32_array(
  a: Int32Array,
  b: Int32Array,
  result: Int32Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked((result[i] = unchecked(a[i]) >> unchecked(b[i])));
  }
}

/**
 * Element-wise logical (zero-fill) right shift:
 *   result[i] = (a[i] >>> b[i]) reinterpreted as i32
 *
 * AssemblyScript provides `>>>` over u32; we cast through u32 to mirror
 * JS `(a[i] >>> b[i]) | 0` semantics — the high bit becomes negative on
 * values ≥ 2^31.
 */
export function rightLogShift_i32_array(
  a: Int32Array,
  b: Int32Array,
  result: Int32Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    const av = unchecked(a[i]) as u32;
    const sh = unchecked(b[i]) as u32;
    unchecked((result[i] = (av >>> sh) as i32));
  }
}
