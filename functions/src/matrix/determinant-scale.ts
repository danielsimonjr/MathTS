import { powerOfTwoBelow } from '@danielsimonjr/mathts-core';

/** Apply a binary exponent without manufacturing a zero or infinite scale factor. */
function applyExponent(value: number, exponent: number): number {
  if (value === 0 || !Number.isFinite(value)) return value;
  const unit = powerOfTwoBelow(Math.abs(value));
  const finalExponent = Math.log2(unit) + exponent;
  if (finalExponent > 1023) return Math.sign(value) * Infinity;
  if (finalExponent < -1075) return value < 0 ? -0 : 0;
  const fraction = value / unit;
  return finalExponent === -1075
    ? (fraction / 2) * Number.MIN_VALUE
    : fraction * 2 ** finalExponent;
}

/** Evaluate a numeric determinant after exact row equilibration when cofactors could overflow. */
export function determinantWithScaledRows(
  rows: number[][],
  evaluate: (rows: number[][]) => number
): number {
  const limit = 2 ** Math.floor(900 / rows.length);
  const scales = rows.map((row) => {
    let max = 0;
    for (const value of row) max = Math.max(max, Math.abs(value));
    return max;
  });
  if (scales.some((max) => !Number.isFinite(max))) return evaluate(rows);
  if (scales.includes(0)) return 0;
  if (scales.every((max) => max >= 1 / limit && max <= limit)) return evaluate(rows);

  // Some rows span more than the entire binary64 exponent range after
  // normalization. Keep a finite direct result before trying to rescale.
  const direct = evaluate(rows.map((row) => row.slice()));
  if (Number.isFinite(direct) && direct !== 0) return direct;

  let exponent = 0;
  const normalized = rows.map((row, i) => {
    const scale = powerOfTwoBelow(scales[i]);
    exponent += Math.log2(scale);
    return row.map((value) => value / scale);
  });
  return applyExponent(evaluate(normalized), exponent);
}

/** Multiply pivots after extracting each exponent, retaining the sign and net range. */
export function determinantFromPivots(rows: number[][], parity: number): number {
  let mantissa = parity;
  let exponent = 0;
  for (let i = 0; i < rows.length; i++) {
    const pivot = rows[i][i];
    if (!Number.isFinite(pivot)) return NaN;
    if (pivot === 0) return pivot * mantissa;
    const scale = powerOfTwoBelow(Math.abs(pivot));
    mantissa *= pivot / scale;
    exponent += Math.log2(scale);
    if (Math.abs(mantissa) >= 2) {
      mantissa /= 2;
      exponent++;
    }
  }
  return applyExponent(mantissa, exponent);
}
