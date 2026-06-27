/**
 * Log-linearized curve fitting — AssemblyScript fallback. Each fit returns `[a, b]`.
 */

/** Exponential fit `y = a * exp(b * x)`. Returns [a, b]. */
export function expfit(xs: Float64Array, ys: Float64Array): Float64Array {
  const n: i32 = xs.length;
  const out = new Float64Array(2);
  if (n <= 0) return out;
  let sx: f64 = 0.0;
  let sy: f64 = 0.0;
  let sxx: f64 = 0.0;
  let sxy: f64 = 0.0;
  for (let i = 0; i < n; i++) {
    const absy: f64 = Math.abs(ys[i]);
    const logY: f64 = Math.log(absy != 0.0 ? absy : 1e-15);
    sx += xs[i];
    sy += logY;
    sxx += xs[i] * xs[i];
    sxy += xs[i] * logY;
  }
  const nf: f64 = <f64>n;
  const b: f64 = (nf * sxy - sx * sy) / (nf * sxx - sx * sx);
  const lna: f64 = (sy - b * sx) / nf;
  out[0] = Math.exp(lna);
  out[1] = b;
  return out;
}

/** Logarithmic fit `y = a * ln(x) + b`. Returns [a, b]. */
export function logfit(xs: Float64Array, ys: Float64Array): Float64Array {
  const n: i32 = xs.length;
  const out = new Float64Array(2);
  if (n <= 0) return out;
  let sx: f64 = 0.0;
  let sy: f64 = 0.0;
  let sxx: f64 = 0.0;
  let sxy: f64 = 0.0;
  for (let i = 0; i < n; i++) {
    const logX: f64 = Math.log(xs[i]);
    sx += logX;
    sy += ys[i];
    sxx += logX * logX;
    sxy += logX * ys[i];
  }
  const nf: f64 = <f64>n;
  const a: f64 = (nf * sxy - sx * sy) / (nf * sxx - sx * sx);
  const b: f64 = (sy - a * sx) / nf;
  out[0] = a;
  out[1] = b;
  return out;
}

/** Power fit `y = a * x^b`. Returns [a, b]. */
export function powerfit(xs: Float64Array, ys: Float64Array): Float64Array {
  const n: i32 = xs.length;
  const out = new Float64Array(2);
  if (n <= 0) return out;
  let sx: f64 = 0.0;
  let sy: f64 = 0.0;
  let sxx: f64 = 0.0;
  let sxy: f64 = 0.0;
  for (let i = 0; i < n; i++) {
    const logX: f64 = Math.log(xs[i]);
    const logY: f64 = Math.log(ys[i]);
    sx += logX;
    sy += logY;
    sxx += logX * logX;
    sxy += logX * logY;
  }
  const nf: f64 = <f64>n;
  const b: f64 = (nf * sxy - sx * sy) / (nf * sxx - sx * sx);
  const lna: f64 = (sy - b * sx) / nf;
  out[0] = Math.exp(lna);
  out[1] = b;
  return out;
}
