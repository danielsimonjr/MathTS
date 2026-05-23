/**
 * Signal windowing / resampling kernels — AssemblyScript fallback mirroring
 * `wasm-rust/.../signal/windowing.rs`.
 */

/** Linear-interpolation resampling of `x` from `oldRate` to `newRate`. */
export function resample(x: Float64Array, newRate: f64, oldRate: f64): Float64Array {
  if (x.length <= 0 || newRate <= 0.0 || oldRate <= 0.0) {
    return new Float64Array(0);
  }
  const ratio: f64 = oldRate / newRate;
  const newLen: i32 = <i32>Math.round(<f64>x.length / ratio);
  const out = new Float64Array(newLen);
  const last: i32 = x.length - 1;
  for (let i: i32 = 0; i < newLen; i++) {
    const srcIdx: f64 = <f64>i * ratio;
    let lo: i32 = <i32>Math.floor(srcIdx);
    if (lo < 0) lo = 0;
    if (lo > last) lo = last;
    let hi: i32 = lo + 1;
    if (hi > last) hi = last;
    const frac: f64 = srcIdx - <f64>lo;
    out[i] = x[lo] * (1.0 - frac) + x[hi] * frac;
  }
  return out;
}

/** Median filter of `x` with window size `n` (forced odd). */
export function medfilt(x: Float64Array, n: i32): Float64Array {
  if (x.length <= 0) return new Float64Array(0);
  let win: i32 = n < 1 ? 1 : n;
  if (win % 2 == 0) win += 1;
  const half: i32 = win / 2;
  const out = new Float64Array(x.length);
  const work = new Float64Array(win);
  for (let i: i32 = 0; i < x.length; i++) {
    let wlen: i32 = 0;
    for (let j: i32 = i - half; j <= i + half; j++) {
      if (j >= 0 && j < x.length) {
        work[wlen] = x[j];
        wlen++;
      }
    }
    for (let a: i32 = 1; a < wlen; a++) {
      const key: f64 = work[a];
      let b: i32 = a;
      while (b > 0 && work[b - 1] > key) {
        work[b] = work[b - 1];
        b--;
      }
      work[b] = key;
    }
    out[i] = work[wlen / 2];
  }
  return out;
}

/**
 * Generate a window of length `n`. `windowType`: 0 rectangular, 1 hamming,
 * 2 hann, 3 blackman, 4 bartlett.
 */
export function windowFunction(n: i32, windowType: i32): Float64Array {
  if (n <= 0) return new Float64Array(0);
  const out = new Float64Array(n);
  const n1: f64 = <f64>(n - 1);
  for (let i: i32 = 0; i < n; i++) {
    const fi: f64 = <f64>i;
    let v: f64;
    if (windowType == 1) {
      v = 0.54 - 0.46 * Math.cos((2.0 * Math.PI * fi) / n1);
    } else if (windowType == 2) {
      v = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * fi) / n1));
    } else if (windowType == 3) {
      v =
        0.42 -
        0.5 * Math.cos((2.0 * Math.PI * fi) / n1) +
        0.08 * Math.cos((4.0 * Math.PI * fi) / n1);
    } else if (windowType == 4) {
      v = 1.0 - Math.abs((2.0 * fi - n1) / n1);
    } else {
      v = 1.0;
    }
    out[i] = v;
  }
  return out;
}
