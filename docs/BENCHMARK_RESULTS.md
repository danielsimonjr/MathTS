# MathTS Performance Benchmark Results

## Overview

This document presents the performance comparison between JavaScript, WebAssembly (WASM), and WASM+SIMD implementations of various mathematical operations in MathTS.

> **Note**: These results cover the AssemblyScript WASM toolchain (the sole WASM backend). For the latest JS-vs-WASM comparison, see [performance.md](./performance.md).

## Live dispatch (`functions` package, after `loadWasm()`)

Authoritative bands: `functions/src/wasm/policy.ts` (`wasmPolicyAllows`). The two tables
of this section are written by `tools/benchmark/wasm/gen-benchmark-results.mjs` from
`docs/benchmarks/wasm-public-call.json`. Do not edit the text between the `bench:begin`
and `bench:end` markers: change the measurement, then run the generator.

- Measure again: `bun run build`, then `node tools/benchmark/wasm/gen-benchmark-results.mjs --measure`.
  Run it twice. A second run goes to a second file with `--data FILE --doc FILE`;
  `docs/benchmarks/wasm-public-call-run2.json` is the second run of the table below, and a row
  whose ratio differs between the two runs is noise.
- Render only: `node tools/benchmark/wasm/gen-benchmark-results.mjs --render`.
- Check the file against its record: `node tools/benchmark/wasm/gen-benchmark-results.mjs --check`.

### Dispatch bands

<!-- bench:begin policy -->

Rendered from `wasmDispatchPolicy()` as it was during the measurement (2026-11-13,
Node 26.13.0, win32 x64). The authority is
`functions/src/wasm/policy.ts`; a kernel with no row stays on JavaScript after `loadWasm()`.

| Policy key (AS export) | Band (`min` ≤ n, optional `max`) |
| ---------------------- | -------------------------------- |
| `array_abs_ptr`        | n ≥ 1_024                        |
| `array_atanh_ptr`      | n ≥ 16_384                       |
| `array_cos_ptr`        | n ≥ 16_384                       |
| `array_log10_ptr`      | n ≥ 1_024                        |
| `array_log1p_ptr`      | 1_024 ≤ n < 16_384               |
| `array_log_ptr`        | n ≥ 16_384                       |
| `array_sec_ptr`        | 16_384 ≤ n < 1_048_576           |
| `array_sin_ptr`        | 16_384 ≤ n < 65_536              |
| `cheb_fit_f64`         | n ≥ 1_024                        |
| `fused_chain`          | n ≥ 1_024                        |
| `legendre_fit_f64`     | n ≥ 1_024                        |
| `lgamma_f64`           | n ≥ 1_048_576                    |
| `poly_fit_f64`         | n ≥ 1_024                        |
| `sort_f64`             | n ≥ 1_048_576                    |

<!-- bench:end policy -->

Kernels without a row (Bessel, Airy, elliptic, Carlson, Welch/Goertzel/chirp-Z,
divided differences, polynomial division, bitwise, and others listed in the policy
header) stay on JavaScript even when the module is loaded.

### Public call after `loadWasm()` (shipped policy)

Every row calls the public function on a `Float64Array`. The script switches the tier off and on
inside one process and alternates the repetitions. The ratio is `loaded / unloaded`, so a ratio
below 1 means that `await loadWasm()` makes the call faster. A call outside its band runs the
JavaScript path in both tiers, so its ratio is 1 within the noise of the run, and the last
column says `no`. The column `Max rel. diff` is the largest relative difference between the
two tiers.

<!-- bench:begin public-call -->

Measured 2026-11-13 on Node 26.13.0 (V8), win32 x64.

| Call  | n         | Unloaded (ms) | Loaded (ms) | Ratio | Max rel. diff | WASM ran             |
| ----- | --------- | ------------- | ----------- | ----- | ------------- | -------------------- |
| `sin` | 16_384    | 0.352         | 0.312       | 0.88  | 1.1e-16       | yes                  |
| `sin` | 131_072   | 2.411         | 2.462       | 1.02  | 0             | no (JavaScript path) |
| `sin` | 1_048_576 | 22.269        | 20.034      | 0.90  | 0             | no (JavaScript path) |
| `cos` | 16_384    | 0.723         | 0.327       | 0.45  | 1.1e-16       | yes                  |
| `cos` | 131_072   | 7.906         | 2.551       | 0.32  | 1.1e-16       | yes                  |
| `cos` | 1_048_576 | 51.083        | 22.501      | 0.44  | 1.1e-16       | yes                  |
| `tan` | 16_384    | 1.338         | 1.393       | 1.04  | 0             | no (JavaScript path) |
| `tan` | 131_072   | 7.194         | 7.255       | 1.01  | 0             | no (JavaScript path) |
| `tan` | 1_048_576 | 72.211        | 75.600      | 1.05  | 0             | no (JavaScript path) |
| `abs` | 16_384    | 0.493         | 0.126       | 0.26  | 0             | yes                  |
| `abs` | 131_072   | 5.006         | 0.765       | 0.15  | 0             | yes                  |
| `abs` | 1_048_576 | 31.797        | 5.171       | 0.16  | 0             | yes                  |
| `exp` | 16_384    | 1.442         | 1.435       | 0.99  | 0             | no (JavaScript path) |
| `exp` | 131_072   | 6.903         | 6.530       | 0.95  | 0             | no (JavaScript path) |
| `exp` | 1_048_576 | 56.217        | 57.800      | 1.03  | 0             | no (JavaScript path) |
| `log` | 16_384    | 0.714         | 0.406       | 0.57  | 2.2e-16       | yes                  |
| `log` | 131_072   | 6.280         | 3.181       | 0.51  | 2.2e-16       | yes                  |
| `log` | 1_048_576 | 58.207        | 31.673      | 0.54  | 2.2e-16       | yes                  |

<!-- bench:end public-call -->

### The kernel on its own (dispatch policy overridden)

The same calls with the dispatch policy overridden, so the AssemblyScript kernel runs at every
size. These rows show what a kernel can do. A consumer does not get these numbers, because the
dispatch bands above decide which calls reach the kernel. The two passes run in separate
processes, so compare a ratio only with the unloaded time of its own table.

<!-- bench:begin kernel-call -->

Measured 2026-11-13 on Node 26.13.0 (V8), win32 x64.

| Call  | n         | Unloaded (ms) | Loaded (ms) | Ratio | Max rel. diff |
| ----- | --------- | ------------- | ----------- | ----- | ------------- |
| `sin` | 16_384    | 0.486         | 0.427       | 0.88  | 1.1e-16       |
| `sin` | 131_072   | 3.706         | 3.847       | 1.04  | 1.1e-16       |
| `sin` | 1_048_576 | 36.298        | 25.979      | 0.72  | 1.1e-16       |
| `cos` | 16_384    | 1.076         | 0.453       | 0.42  | 1.1e-16       |
| `cos` | 131_072   | 7.514         | 2.746       | 0.37  | 1.1e-16       |
| `cos` | 1_048_576 | 90.687        | 25.245      | 0.28  | 1.1e-16       |
| `tan` | 16_384    | 1.915         | 0.954       | 0.50  | 0             |
| `tan` | 131_072   | 15.346        | 7.400       | 0.48  | 0             |
| `tan` | 1_048_576 | 127.947       | 53.422      | 0.42  | 0             |
| `abs` | 16_384    | 0.769         | 0.178       | 0.23  | 0             |
| `abs` | 131_072   | 4.069         | 0.902       | 0.22  | 0             |
| `abs` | 1_048_576 | 86.732        | 7.736       | 0.09  | 0             |
| `exp` | 16_384    | 1.820         | 0.937       | 0.51  | 1.6e-16       |
| `exp` | 131_072   | 12.112        | 5.443       | 0.45  | 2.0e-16       |
| `exp` | 1_048_576 | 116.359       | 40.022      | 0.34  | 2.0e-16       |
| `log` | 16_384    | 0.892         | 0.490       | 0.55  | 2.2e-16       |
| `log` | 131_072   | 11.945        | 6.049       | 0.51  | 2.2e-16       |
| `log` | 1_048_576 | 102.640       | 36.265      | 0.35  | 2.2e-16       |

<!-- bench:end kernel-call -->

---

## Recreated AS-vs-JS suite (`tools/benchmark/wasm/`) — 2026-06-27

> **Historical snapshot.** Bun/JSC `npm run bench:wasm` on one machine (2026-06-27).
> Tier order and size bands below do **not** match live `wasmPolicyAllows` dispatch;
> see [Live dispatch](#live-dispatch-functions-package-after-loadwasm) and
> `functions/src/wasm/policy.ts`.

The standalone WASM benchmark suite was recreated as an **AssemblyScript-vs-JS**
suite. Each row is a full JS↔wasm round-trip (JS `Float64Array` in → AS kernel →
out), median of several reps, with a correctness `maxdiff` vs the JS fallback.
`AS/JS < 1.00x` means AssemblyScript wins.

Reproduce: `npm run bench:wasm` (or `bench:elementwise` / `bench:special` /
`bench:sort` / `bench:matrix`).

**Environment (this snapshot):** Node v24.18.0, win32 x64. These are
hardware-specific — re-run on your target machine for authoritative figures.

### Elementwise transcendentals

The elementwise rows of this suite timed one AS kernel against `Math.*` on its own. They are not
kept: a consumer calls the public function after `loadWasm()`, and the tables in
[Live dispatch](#live-dispatch-functions-package-after-loadwasm) time that call, with and
without the dispatch policy.

### Special functions (AS managed kernels vs JS scalars)

| op         | n = 16,384 | n = 131,072 | n = 1e6    | maxdiff   |
| ---------- | ---------- | ----------- | ---------- | --------- |
| bessel_j0  | 1.09x (JS) | 0.99x       | 1.25x (JS) | 2.78e-17  |
| bessel_j1  | 1.02x (JS) | 1.06x (JS)  | 0.91x      | 2.78e-17  |
| lgamma     | 1.01x (JS) | 0.86x       | 1.02x (JS) | 2.84e-14  |
| elliptic_k | 0.97x      | 0.95x       | 0.92x      | 0 (exact) |

Bessel is roughly at parity — the JS scalar fallbacks are already tight, so the
AS kernels mostly trade blows with them rather than dominating.

### Sort (`sort_f64` introsort vs JS NaN-last comparator sort)

| n       | AS/JS | maxdiff   |
| ------- | ----- | --------- |
| 16,384  | 0.30x | 0 (exact) |
| 131,072 | 0.29x | 0 (exact) |
| 1e6     | 0.28x | 0 (exact) |

AS wins ~3x here. Note the JS baseline is a _comparator_ sort (NaN-last
semantics force `Array.prototype.sort(cmp)`, off V8's fast numeric path); against
a bare `Float64Array.sort()` the gap would close, but that does not implement the
required NaN-last order.

### Matrix heavy ops + FFT (AS vs JS)

| op                           | small      | medium     | large      | maxdiff   |
| ---------------------------- | ---------- | ---------- | ---------- | --------- |
| multiply (64/256/512)        | 0.50x      | 0.28x      | 0.31x      | 0 (exact) |
| svd (32/64/128)              | 1.61x (JS) | 2.61x (JS) | 1.84x (JS) | ≤5.68e-13 |
| eig sym (32/64/128)          | 0.49x      | 0.45x      | 0.31x      | ≤1.71e-13 |
| welch-psd FFT (16K/131K/1e6) | 1.23x (JS) | 1.40x (JS) | 1.25x (JS) | ≤5.55e-17 |

Honest outliers: **svd** — the AS one-sided Jacobi is ~1.6–2.6x _slower_ than the
JS Golub-Reinsch at these sizes (it converges in more sweeps); singular values
still match to ≤6e-13. **welch-psd** — JS wins ~1.2–1.4x; V8 JITs the frame FFT
loop well and the per-frame marshalling adds up. multiply and eig are clear AS
wins (~2–3x).

---

**Test Environment:**

- Node.js with AssemblyScript-compiled WASM modules
- SIMD enabled for supported operations
- Testing sizes: 100 to 100,000 elements for vectors, 10x10 to 50x50 for matrices

> **Historical snapshot (pre-2026-06-27 suite).** SIMD tables and narrative below
> predate `functions/src/wasm/policy.ts` and contradict live dispatch; kept for
> archaeology only.

## Summary

| Operation               | JS (100K) | WASM (100K) | SIMD (100K) | Best Speedup   |
| ----------------------- | --------- | ----------- | ----------- | -------------- |
| Vector Addition         | 2.789ms   | 4.977ms     | 2.630ms     | 1.90x (small)  |
| Vector Multiplication   | 2.693ms   | 2.890ms     | 2.783ms     | 1.49x (small)  |
| Dot Product             | 2.156ms   | 3.467ms     | 2.280ms     | 1.28x (small)  |
| Sum                     | 1.221ms   | 1.201ms     | 1.217ms     | 2.61x (small)  |
| Mean                    | 1.208ms   | 1.286ms     | 1.271ms     | 1.04x (small)  |
| Variance                | 1.361ms   | 1.318ms     | -           | 1.73x (small)  |
| Standard Deviation      | 1.356ms   | 1.298ms     | -           | 1.14x (medium) |
| L2 Norm                 | 1.196ms   | 1.345ms     | -           | 2.12x (small)  |
| Min                     | 1.289ms   | 1.453ms     | -           | 2.51x (small)  |
| Max                     | 1.211ms   | 1.609ms     | -           | 2.58x (small)  |
| Matrix Multiply (50x50) | 0.265ms   | 2.060ms     | 1.055ms     | 2.15x (small)  |
| Matrix-Vector Multiply  | 0.131ms   | 0.235ms     | -           | 1.35x (small)  |
| FFT                     | 0.770ms   | 10.570ms    | -           | 0.85x (small)  |

## Key Findings

### 1. SIMD Optimization Benefits

SIMD-optimized operations show significant improvements for small to medium datasets:

- **Vector Addition (100 elements)**: 1.90x speedup
- **Matrix Multiplication (10x10)**: 2.15x speedup
- **Vector Multiplication (100 elements)**: 1.49x speedup

### 2. WASM Excels at Simple Operations

WASM shows excellent performance for simple reduction operations on small datasets:

- **Sum (100 elements)**: 2.61x faster than JavaScript
- **Min (100 elements)**: 2.51x faster than JavaScript
- **Max (100 elements)**: 2.58x faster than JavaScript
- **L2 Norm (100 elements)**: 2.12x faster than JavaScript
- **Variance (100 elements)**: 1.73x faster than JavaScript

### 3. Data Marshaling Overhead

For larger datasets (10K+ elements), the overhead of copying data between JavaScript and WASM memory reduces performance benefits. This is a known limitation when:

- Creating new TypedArrays in WASM
- Returning results back to JavaScript
- Not using SharedArrayBuffer for zero-copy transfers

### 4. Recommendations

#### When to use WASM:

- Small to medium datasets (< 10,000 elements)
- Batch operations where data can be kept in WASM memory
- Simple reduction operations (sum, min, max, norm)

#### When to use SIMD:

- Vector operations with data already in memory
- Matrix operations
- Operations that can be vectorized (add, multiply, dot product)

#### When JavaScript may be preferred:

- Very large datasets with single operations
- FFT and other complex algorithms (unless optimized)
- When data transfer overhead dominates

## Detailed Results

### Vector Operations

```
Vector Addition:
  Size 100:    JS=0.018ms, WASM=0.013ms (1.35x), SIMD=0.010ms (1.90x)
  Size 1,000:  JS=0.049ms, WASM=0.102ms (0.48x), SIMD=0.053ms (0.93x)
  Size 10,000: JS=0.253ms, WASM=0.497ms (0.51x), SIMD=0.246ms (1.03x)
  Size 100K:   JS=2.789ms, WASM=4.977ms (0.56x), SIMD=2.630ms (1.06x)

Dot Product:
  Size 100:    JS=0.008ms, WASM=0.007ms (1.28x), SIMD=0.007ms (1.18x)
  Size 1,000:  JS=0.021ms, WASM=0.046ms (0.46x), SIMD=0.023ms (0.90x)
  Size 10,000: JS=0.206ms, WASM=0.340ms (0.61x), SIMD=0.230ms (0.89x)
  Size 100K:   JS=2.156ms, WASM=3.467ms (0.62x), SIMD=2.280ms (0.95x)
```

### Statistical Operations

```
Sum:
  Size 100:    JS=0.006ms, WASM=0.002ms (2.61x)
  Size 1,000:  JS=0.020ms, WASM=0.011ms (1.75x)
  Size 10,000: JS=0.104ms, WASM=0.117ms (0.89x)
  Size 100K:   JS=1.221ms, WASM=1.201ms (1.02x)

Variance:
  Size 100:    JS=0.006ms, WASM=0.003ms (1.73x)
  Size 1,000:  JS=0.019ms, WASM=0.024ms (0.81x)
  Size 10,000: JS=0.123ms, WASM=0.111ms (1.10x)
  Size 100K:   JS=1.361ms, WASM=1.318ms (1.03x)
```

### Matrix Operations

```
Matrix Multiplication (n×n → n elements total):
  10×10:   JS=0.037ms, WASM=0.034ms (1.07x), SIMD=0.017ms (2.15x)
  20×20:   JS=0.023ms, WASM=0.143ms (0.16x), SIMD=0.083ms (0.28x)
  30×30:   JS=0.079ms, WASM=0.446ms (0.18x), SIMD=0.259ms (0.31x)
  50×50:   JS=0.265ms, WASM=2.060ms (0.13x), SIMD=1.055ms (0.25x)
```

## Implementation Notes

### SIMD Operations Implemented

- **f64x2**: 2-wide double-precision operations for vectors
- **f32x4**: 4-wide single-precision operations
- **i32x4**: 4-wide integer operations
- Complex number operations using SIMD

### Parallel Execution Support

The implementation includes WebWorker support for parallel execution:

- `WasmWorkerPool`: Enhanced worker pool with WASM acceleration
- `ParallelMatrix`: Parallel matrix operations
- Automatic fallback for small datasets

## Future Optimizations

1. **SharedArrayBuffer**: Implement zero-copy data transfer
2. **Larger SIMD**: Use f64x4/f32x8 where available
3. **Memory pooling**: Reduce allocation overhead
4. **Batch operations**: Keep data in WASM memory for multiple operations
5. **Algorithm optimization**: Improve FFT and matrix algorithms

## Running Benchmarks

The `tools/benchmark/wasm/` suite is the AssemblyScript-vs-JS benchmark harness
(see the dated snapshot near the top of this file):

```bash
# Full AS-vs-JS WASM benchmark suite
npm run bench:wasm

# Per-area
npm run bench:elementwise
npm run bench:special
npm run bench:sort
npm run bench:matrix

# Run AssemblyScript WASM tests
npm run test:wasm

# Run cross-package WASM integration tests
npm run test:wasm:integration
```

---

## `evaluateScalar` vs `compileScalar` (M3 batch evaluator) — 2026-10-25

Command (V8, not Bun):

```bash
node tools/benchmark/wasm/run-node.mjs scalar
```

**Environment:** Node v22.23.4, linux x64, 2026-10-25. Median wall time after ≥5 warmup rounds
and ABBA-interleaved reps (`ratio = batchMs / interpMs`; `< 1` means `compileScalar` batch wins).
Trees: **small** (5 nodes, `(x*x)+3`), **mid** (10 nodes, `sin(x)*exp(x)+ln(x+1)`), **large** (28
nodes, left-fold `+` of eight unary/binary terms). Column `x` is mulberry32 seed 1 on `(0.15,
0.85)`. Correctness: bit-for-bit `Object.is` on every row before timing (`maxDiff` 0).

**Control** (identical thunks: `compiled.evaluate([col])` twice, small tree, `n = 1e4`): run 1
ratio **0.9853**; run 2 ratio **1.0400** (harness order bias ≈ 1.00).

### Run 1

| tree  | n=100 | n=1e3 | n=1e4 | n=1e5 | n=1e6 |
| ----- | ----- | ----- | ----- | ----- | ----- |
| small | 0.06  | 0.22  | 0.19  | 0.22  | 0.25  |
| mid   | 0.11  | 0.33  | 0.31  | 0.32  | 0.32  |
| large | 0.27  | 0.28  | 0.29  | 0.29  | 0.27  |

### Run 2

| tree  | n=100 | n=1e3 | n=1e4 | n=1e5 | n=1e6 |
| ----- | ----- | ----- | ----- | ----- | ----- |
| small | 0.04  | 0.20  | 0.18  | 0.21  | 0.31  |
| mid   | 0.15  | 0.32  | 0.25  | 0.35  | 0.38  |
| large | 0.27  | 0.26  | 0.23  | 0.25  | 0.31  |

**Verdict (both runs):** `compileScalar` batch evaluation is faster than per-row
`evaluateScalar` at every size on this grid for all three trees. No crossover inside
`[100, 1e6]`. At `n = 100` both runs have ratio 0.04–0.27 (all trees; outside the
`[0.8, 1.25]` noise band), so **M14 population-eval threshold = 100 rows** (use batch at
`n ≥ 100`). Gated claim row: **large tree, `n = 1e6`** — ratios **0.27** (run 1) and
**0.31** (run 2).

---

## Scalar-search harness (`tools/benchmark/scalar-search/`) — SR-11

A dedicated harness for the scalar symbolic-regression engine exists since SR-11 of
[`docs/plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md`](./plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md).
It times `searchScalars` and `compileScalar`, checks the seed-7 pinned search of
120 evaluations (front matched to `tools/benchmark/scalar-search/pinned-rows.json` with
`Object.is` before any timing; mismatch fails the process), compile-and-score of that
front, and the internal `evaluateScalarPopulation` module serial vs an **explicit injected
`WorkerPool`** at 100 / 1e3 / 1e4 / 1e5 rows on the mid-size M3 tree. Case (3) reports
cold pool (per sample) and reused pool (search lifetime). This does not measure the default
`parallel: {}` path inside `searchScalars`. An A/A control
uses two **distinct** but identical serial closures (same rule as `tools/benchmark/ab`).
Warm-up is ≥ 5 reps, medians are printed, and the harness asserts no speedup; it is the
measurement gate for later search-speed claims.

Reproduce (one process per engine; default engine is Node; `--reps <n>` raises the rep floor):

```bash
bun run bench:scalar-search                                                    # Node (V8)
bun run bench:scalar-search:bun                                                # Bun (JSC)
# or directly:
node tools/benchmark/scalar-search/run.mjs --engine node
bun --tsconfig-override=tsconfig.base.json tools/benchmark/scalar-search/run.mjs --engine bun
```

**This harness replaces no M3 number.** The `evaluateScalar` vs `compileScalar` table
above stays the record for the batch-evaluator threshold.

**Environment (this snapshot):** Linux x64 VM, Node v22.23.4 and Bun 1.4.4, 2026-11-05.
Case (3) reports **cold** pool (create + `terminate()` on every timed sample) and **reused**
pool (one `WorkerPool` for warmup and samples, matching `searchScalars`). Worker spawn
dominates cold-pool times (~130–260 ms); `terminate()` is ~0.3 ms and is not the bottleneck.

| case                                       | Node run 1 | Node run 2 | Bun run 1 | Bun run 2 |
| ------------------------------------------ | ---------- | ---------- | --------- | --------- |
| compile + score the pinned front (3 trees) | 0.0301     | 0.0300     | 0.0091    | 0.0089    |
| seed-7 pinned search, 120 evaluations      | 2.0955     | 1.9875     | 1.2972    | 1.3949    |
| population serial, n = 100                 | 0.1346     | 0.1333     | 0.1341    | 0.1325    |
| population parallel cold, n = 100          | 186.3623   | 182.1944   | 137.0332  | 136.0682  |
| population parallel reused, n = 100        | 0.2397     | 0.3275     | 0.2242    | 0.2635    |
| population serial, n = 1e3                 | 0.8135     | 0.8189     | 0.5505    | 0.5626    |
| population parallel cold, n = 1e3          | 191.1687   | 191.5293   | 140.8056  | 137.7948  |
| population parallel reused, n = 1e3        | 0.7132     | 0.7834     | 0.5310    | 0.7938    |
| population serial, n = 1e4                 | 9.6098     | 9.3954     | 6.9114    | 7.1118    |
| population parallel cold, n = 1e4          | 197.1643   | 200.8754   | 149.7926  | 148.2384  |
| population parallel reused, n = 1e4        | 5.4783     | 5.2214     | 2.9770    | 2.9260    |
| population serial, n = 1e5                 | 83.7314    | 85.4391    | 51.9887   | 51.2862   |
| population parallel cold, n = 1e5          | 259.0763   | 253.2210   | 182.9947  | 177.5221  |
| population parallel reused, n = 1e5        | 51.5150    | 54.8901    | 23.9071   | 23.8350   |

**A/A control** (two distinct serial closures, n = 1e4), ratio over five runs: Node
**0.9889–1.0255**, Bun **0.9895–0.9929** (observed band on this VM; not a hard ±2% gate).

---

## Worker threshold from a measurement (`SCALAR_PARALLEL_MIN_ROWS`) — SR-14

SR-14 of [`docs/plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md`](./plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md)
ran SR-11 case (3) (`evaluateScalarPopulation`, serial vs an explicit injected
`WorkerPool`, 8 items, mid tree) **twice on Node and twice on Bun**, in fresh
processes, on the same Linux x64 VM (Node v22.23.4, Bun 1.4.4, 2026-11-05).

**Pool lifetime for the decision:** one reused `WorkerPool` for warmup and all timed
samples (same lifetime as `searchScalars`). A **cold** column (new pool + `terminate()`
per sample) is kept below; it always looks like ~130–260 ms parallel time because worker
**create** dominates (~0.3 ms for **terminate**). One constant cannot serve both lifetimes;
the cold path is diagnostic only.

Medians, ms; ratio = parallel / serial.

### Reused pool (decision column)

| rows    | Node run 1 serial / parallel (ratio) | Node run 2 serial / parallel (ratio) | Bun run 1 serial / parallel (ratio) | Bun run 2 serial / parallel (ratio) |
| ------- | ------------------------------------ | ------------------------------------ | ----------------------------------- | ----------------------------------- |
| 100     | 0.1346 / 0.2397 (1.78)               | 0.1333 / 0.3275 (2.46)               | 0.1341 / 0.2242 (1.67)              | 0.1325 / 0.2635 (1.99)              |
| 1 000   | 0.8135 / 0.7132 (0.88)               | 0.8189 / 0.7834 (0.96)               | 0.5505 / 0.5310 (0.96)              | 0.5626 / 0.7938 (1.41)              |
| 10 000  | 9.6098 / 5.4783 (0.57)               | 9.3954 / 5.2214 (0.56)               | 6.9114 / 2.9770 (0.43)              | 7.1118 / 2.9260 (0.41)              |
| 100 000 | 83.7314 / 51.5150 (0.62)             | 85.4391 / 54.8901 (0.64)             | 51.9887 / 23.9071 (0.46)            | 51.2862 / 23.8350 (0.46)            |

### Cold pool (per-sample create + terminate; not used for the constant)

| rows    | Node run 1 serial / parallel (ratio) | Node run 2 serial / parallel (ratio) | Bun run 1 serial / parallel (ratio) | Bun run 2 serial / parallel (ratio) |
| ------- | ------------------------------------ | ------------------------------------ | ----------------------------------- | ----------------------------------- |
| 100     | 0.1346 / 186.3623 (1385)             | 0.1333 / 182.1944 (1367)             | 0.1341 / 137.0332 (1022)            | 0.1325 / 136.0682 (1027)            |
| 1 000   | 0.8135 / 191.1687 (235)              | 0.8189 / 191.5293 (234)              | 0.5505 / 140.8056 (256)             | 0.5626 / 137.7948 (245)             |
| 10 000  | 9.6098 / 197.1643 (20.5)             | 9.3954 / 200.8754 (21.4)             | 6.9114 / 149.7926 (21.7)            | 7.1118 / 148.2384 (20.8)            |
| 100 000 | 83.7314 / 259.0763 (3.09)            | 85.4391 / 253.2210 (2.96)            | 51.9887 / 182.9947 (3.52)           | 51.2862 / 177.5221 (3.46)           |

A/A control (two distinct serial closures, n = 1e4), one ratio per process: Node **1.0255**
and **0.9889**, Bun **0.9895** and **0.9929**.

**Decision: `SCALAR_PARALLEL_MIN_ROWS` = 10_000.** The rule requires the reused-pool
median at or below 0.95× serial in all four runs, with the next lower row count failing
that bar in at least one run. At **n = 1_000**, Bun run 2 ratio is **1.41** (and Node
run 2 is **0.96**, above 0.95). At **n = 10_000**, all four ratios are **0.41–0.57**.
The earlier cold-pool-only pass incorrectly left the constant at 100.

Patch changeset on `@danielsimonjr/mathts-functions`. Bun started `worker_threads`
normally in all four runs. The seed-7 pin matched `pinned-rows.json` with `Object.is`
before timing in all four runs. This measures case (3) only; **no speedup is claimed for
`searchScalars` as a whole** from this constant alone.
