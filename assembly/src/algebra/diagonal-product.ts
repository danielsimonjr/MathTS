/** Product of the diagonal of a packed matrix with the binary exponent held separately. */
export function scaledDiagonalProduct<T>(work: T, n: i32, sign: f64): f64 {
  let mantissa = sign;
  let exponent: i64 = 0;
  for (let i = 0; i < n; i++) {
    let value: f64 = work[i * (n + 1)];
    if (value == 0.0 || !isFinite(value)) {
      mantissa *= value;
      continue;
    }
    let correction: i32 = 0;
    if (Math.abs(value) < 2.2250738585072014e-308) {
      value *= 18014398509481984.0; // 2^54 puts subnormals in the normal range.
      correction = 54;
    }
    const bits = reinterpret<u64>(value);
    const biased = <i32>((bits >> 52) & 0x7ff);
    const normalized = reinterpret<f64>((bits & 0x800fffffffffffff) | 0x3ff0000000000000);
    mantissa *= normalized;
    exponent += <i64>(biased - 1023 - correction);
    if (Math.abs(mantissa) >= 2.0) {
      mantissa *= 0.5;
      exponent++;
    }
  }
  if (mantissa == 0.0 || !isFinite(mantissa)) return mantissa;
  if (exponent > 1023) return mantissa > 0.0 ? Infinity : -Infinity;
  if (exponent < -1075) return mantissa * 0.0;
  if (exponent < -1022) {
    return mantissa * Math.pow(2.0, <f64>(exponent + 1022)) * 2.2250738585072014e-308;
  }
  return mantissa * Math.pow(2.0, <f64>exponent);
}
