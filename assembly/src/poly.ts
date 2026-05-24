/**
 * Polynomial hot-loop kernels — AssemblyScript parity port.
 *
 * These two exports mirror the Rust kernels in
 * `wasm-rust/crates/mathts-wasm/src/poly.rs`.
 *
 * Naming uses snake_case to match the Rust export surface so the
 * bridge can probe for either backend with the same name lookup.
 *
 * Polynomials are coefficient arrays, constant term first (index = power):
 *   p(x) = a[0] + a[1]*x + a[2]*x^2 + …
 */

// ---------------------------------------------------------------------------
// poly_mul_f64  — O(n·m) convolution
// ---------------------------------------------------------------------------

/**
 * Multiply polynomials `a` and `b`.
 * Returns a `Float64Array` of length `a.length + b.length - 1`,
 * or `[0.0]` if either operand is empty.
 */
export function poly_mul_f64(a: Float64Array, b: Float64Array): Float64Array {
  if (a.length == 0 || b.length == 0) {
    const z = new Float64Array(1);
    z[0] = 0.0;
    return z;
  }
  const outLen: i32 = a.length + b.length - 1;
  const out = new Float64Array(outLen);
  for (let i = 0; i < outLen; i++) out[i] = 0.0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    for (let j = 0; j < b.length; j++) {
      out[i + j] += ai * b[j];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// poly_div_mod_f64  — polynomial long division
// ---------------------------------------------------------------------------

/**
 * Divide polynomial `num` by `den`.
 *
 * Returns a concatenated `Float64Array`:
 *   `[ quotient (q_len elements) | remainder (r_len elements) ]`
 *
 * where:
 *   q_len  = max(0, num.length - den.length + 1)  when den.length <= num.length
 *   q_len  = 0                                    when den.length  > num.length
 *   r_len  = den.length - 1                        (un-trimmed; caller trims)
 *
 * Returns `[NaN]` when `den` is empty (division by zero).
 */
export function poly_div_mod_f64(num: Float64Array, den: Float64Array): Float64Array {
  if (den.length == 0) {
    const e = new Float64Array(1);
    e[0] = NaN;
    return e;
  }

  const numLen: i32 = num.length;
  const denLen: i32 = den.length;

  // degree(num) < degree(den): quotient = 0, remainder = num
  if (numLen < denLen) {
    const out = new Float64Array(numLen);
    for (let i = 0; i < numLen; i++) out[i] = num[i];
    return out;
  }

  const qLen: i32 = numLen - denLen + 1;
  const rMax: i32 = denLen - 1;

  // Work buffer (copy of num).
  const work = new Float64Array(numLen);
  for (let i = 0; i < numLen; i++) work[i] = num[i];

  const bn = den[denLen - 1];

  const quotient = new Float64Array(qLen);
  for (let i = 0; i < qLen; i++) quotient[i] = 0.0;

  // Long division, highest degree first.
  let ii: i32 = 0;
  while (ii < qLen) {
    const i: i32 = numLen - 1 - ii;
    const q = work[i] / bn;
    quotient[i - denLen + 1] = q;
    for (let j: i32 = 0; j < denLen; j++) {
      work[i - denLen + 1 + j] -= q * den[j];
    }
    ii++;
  }

  const rLen: i32 = rMax < numLen ? rMax : numLen;
  const totalLen: i32 = qLen + rLen;
  const out = new Float64Array(totalLen);
  for (let i: i32 = 0; i < qLen; i++) out[i] = quotient[i];
  for (let i: i32 = 0; i < rLen; i++) out[qLen + i] = work[i];
  return out;
}
