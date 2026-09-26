/**
 * Where the AssemblyScript tier runs once a consumer has called `loadWasm()`.
 *
 * Loading the module does not make a function faster by itself: each bridge copies its
 * inputs into WASM memory and its result back out, and V8 already compiles the JS paths
 * well. `tools/benchmark/wasm/opt-in.bench.ts` timed every public function that reaches a
 * bridge with the tier off and on, on Node 22 (V8), reps interleaved, twice. A kernel is
 * listed below only for the sizes where both runs measured the public call faster with the
 * tier on; every other kernel keeps its JavaScript path even when the module is loaded,
 * because the WASM path measured slower (up to 7x for `bitNot`, 4.5x for `welchPSD`) or no
 * faster. To change an entry, re-run the benchmark twice and cite both runs.
 *
 * Keys are the AS kernel export names, as the benchmark's "kernels called" column prints
 * them. A missing key means "never".
 */

/** The sizes at which a kernel dispatches: `min <= n` and, when set, `n < max`. */
export interface WasmBand {
  min: number;
  max?: number;
}

/**
 * Measured 2026-09-26 with opt-in.bench.ts on Node 22 (V8), two runs, sizes 1K/16K/131K/1M
 * (fewer for the costlier kernels). An entry covers the measured sizes where the on/off
 * ratio was below 0.9 in both runs; the comment gives the ratios (run 1 / run 2). A band
 * stops at the first measured size that was not a win in both runs.
 *
 * Kept on JS (ratio on/off in the runs): welch/bartlett PSD 4.0-4.6, resultant and
 * discriminant 3.9-4.3, Newton/Lagrange divided differences 3.9-4.3, chirp-Z 3.2-3.3,
 * polymul 2.6-2.8, bitwise 2.4-3.3, goertzel 1.6-1.8, polynomialQuotient 1.2-1.6, the
 * cubic-spline tridiagonal solve 1.3-1.6, tan/atan/cot/exp/log2/expm1/sinh/tanh 0.94-1.57,
 * Bessel/Airy/elliptic/Carlson 0.93-1.30, erfc 0.98-1.00, argsort 0.92-1.13. apply_window
 * and rank have no public caller.
 */
const WASM_DISPATCH_POLICY: Readonly<Record<string, WasmBand>> = {
  // Element-wise (public `abs`, `sin`, ... on a Float64Array).
  array_abs_ptr: { min: 1024 }, // 0.76/0.55 · 0.44/0.42 · 0.54/0.54 · 0.49/0.71
  array_log10_ptr: { min: 1024 }, // 0.89/0.82 · 0.70/0.77 · 0.70/0.72 · 0.76/0.83
  array_sin_ptr: { min: 1024, max: 131072 }, // 0.76/0.77 · 0.72/0.75 · (0.92/0.81 · 0.79/0.96)
  array_log1p_ptr: { min: 1024, max: 16384 }, // 0.82/0.88 · (1.09/1.24 ...)
  array_cos_ptr: { min: 16384 }, // (1.54/0.79) · 0.64/0.61 · 0.62/0.62 · 0.79/0.69
  array_atanh_ptr: { min: 16384 }, // (0.93/0.85) · 0.70/0.73 · 0.77/0.78 · 0.81/0.83
  array_log_ptr: { min: 16384 }, // (0.92/0.86) · 0.80/0.77 · 0.80/0.79 · 0.84/0.83
  array_sec_ptr: { min: 16384, max: 1048576 }, // 0.76/0.79 · 0.76/0.83 · (0.90/0.88)
  // A fused chain keeps its data in WASM memory between ops: (sin, exp) 0.36-0.49 and
  // (tanh, expm1), both of which lose alone, 0.64-0.77, at every size.
  fused_chain: { min: 1024 },
  // Least-squares fits (public polyFit / chebyshevFit / legendreFit): 0.34-0.67.
  poly_fit_f64: { min: 1024 },
  cheb_fit_f64: { min: 1024 },
  legendre_fit_f64: { min: 1024 },
  // Only the largest measured size wins: lgamma 0.77/0.78, sort (median, quantile)
  // 0.78/0.81 and 0.77/0.79 at 1M; 131K was 0.90-1.05.
  lgamma_f64: { min: 1048576 },
  sort_f64: { min: 1048576 },
};

let overrides: Record<string, WasmBand | null> | null = null;

/**
 * Whether the bridge for `kernel` should call it for an input of size `n`. The bridges
 * check this after their own preconditions and before touching the module; a `false`
 * means the JS path runs, exactly as when the module is not loaded.
 */
export function wasmPolicyAllows(kernel: string, n: number): boolean {
  const own = (o: Record<string, WasmBand | null>, k: string): boolean =>
    Object.prototype.hasOwnProperty.call(o, k);
  const band =
    overrides !== null && own(overrides, kernel)
      ? overrides[kernel]
      : overrides !== null && own(overrides, '*')
        ? overrides['*']
        : WASM_DISPATCH_POLICY[kernel];
  return band != null && n >= band.min && (band.max === undefined || n < band.max);
}

/**
 * Replace the band of some kernels (`null`: never) until the returned function is called.
 * The key `'*'` sets every kernel without its own entry, e.g. `{ '*': { min: 0 } }` lets
 * each bridge's own size threshold decide, as before the policy existed. For tests that
 * must exercise a kernel the policy keeps off, and for benchmarks. Not part of the
 * package's public API.
 */
export function overrideWasmPolicy(entries: Record<string, WasmBand | null>): () => void {
  const previous = overrides;
  overrides = { ...(previous ?? {}), ...entries };
  return () => {
    overrides = previous;
  };
}

/** The measured policy, for tests and documentation. */
export function wasmDispatchPolicy(): Readonly<Record<string, WasmBand>> {
  return WASM_DISPATCH_POLICY;
}
