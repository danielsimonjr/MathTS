# MathTS Performance Benchmark Results

## Overview

This document presents the performance comparison between JavaScript, WebAssembly (WASM), and WASM+SIMD implementations of various mathematical operations in MathTS.

> **Note**: These results cover the AssemblyScript WASM toolchain (the sole WASM backend). For the latest JS-vs-WASM comparison, see [performance.md](./performance.md).

## Live dispatch (`functions` package, after `loadWasm()`)

Authoritative bands: `functions/src/wasm/policy.ts` (`wasmPolicyAllows`). Measured
2026-09-26 on Node 22 (V8); re-measure with two runs of
`node tools/benchmark/wasm/run-node.mjs opt-in` before changing an entry.

| Policy key (AS export)                             | Band (`min` ≤ n, optional `max`) |
| -------------------------------------------------- | -------------------------------- |
| `array_abs_ptr`                                    | n ≥ 1_024                        |
| `array_log10_ptr`                                  | n ≥ 1_024                        |
| `array_sin_ptr`                                    | 1_024 ≤ n < 131_072              |
| `array_log1p_ptr`                                  | 1_024 ≤ n < 16_384               |
| `array_cos_ptr`                                    | n ≥ 16_384                       |
| `array_atanh_ptr`                                  | n ≥ 16_384                       |
| `array_log_ptr`                                    | n ≥ 16_384                       |
| `array_sec_ptr`                                    | 16_384 ≤ n < 1_048_576           |
| `fused_chain`                                      | n ≥ 1_024                        |
| `poly_fit_f64`, `cheb_fit_f64`, `legendre_fit_f64` | n ≥ 1_024                        |
| `lgamma_f64`, `sort_f64`                           | n ≥ 1_048_576                    |

Kernels without a row (Bessel, Airy, elliptic, Carlson, Welch/Goertzel/chirp-Z,
divided differences, polynomial division, bitwise, and others listed in the policy
header) stay on JavaScript even when the module is loaded.

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

### Elementwise transcendentals (AS `array_<op>_ptr` vs `Math.*`)

| op                  | n = 16,384 | n = 131,072 | n = 1e6    |
| ------------------- | ---------- | ----------- | ---------- |
| abs                 | 1.52x (JS) | 1.15x (JS)  | 1.15x (JS) |
| sin                 | 0.43x      | 0.63x       | 0.32x      |
| cos                 | 0.46x      | 0.44x       | 0.46x      |
| tan                 | 0.71x      | 0.42x       | 0.66x      |
| exp                 | 0.54x      | 0.47x       | 0.49x      |
| log                 | 0.82x      | 0.47x       | 0.50x      |
| sinh                | 0.60x      | 0.70x       | 0.61x      |
| tanh                | 0.69x      | 0.52x       | 0.55x      |
| fusion[sin→cos→exp] | 0.99x      | 0.94x       | 0.78x      |

maxdiff ≤ 4.44e-16 across all of the above. `abs` is the one elementwise op
where JS wins above ~16K (V8 hardware abs beats wasm+copy) — included honestly.

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
`WorkerPool`** at 100 / 1e3 / 1e4 / 1e5 rows on the mid-size M3 tree. Case (3) does
**not** measure the default `parallel: {}` path inside `searchScalars`. An A/A control
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
Two full runs per engine below (medians, ms). Parallel columns time pool create, worker
work, and `pool.terminate()` for the explicit pool case (3) injects.

| case                                         | Node run 1 | Node run 2 | Bun run 1 | Bun run 2 |
| -------------------------------------------- | ---------- | ---------- | --------- | --------- |
| compile + score the pinned front (3 trees)   | 0.0303     | 0.0304     | 0.0095    | 0.0096    |
| seed-7 pinned search, 120 evaluations        | 1.9512     | 2.0765     | 1.2366    | 1.2836    |
| population serial, n = 100                   | 0.1910     | 0.1569     | 0.1368    | 0.1360    |
| population parallel (explicit pool), n = 100 | 183.7226   | 187.3152   | 133.8712  | 133.8794  |
| population serial, n = 1e3                   | 1.5806     | 1.2920     | 0.6291    | 0.6010    |
| population parallel (explicit pool), n = 1e3 | 179.7302   | 188.7030   | 137.1184  | 137.6655  |
| population serial, n = 1e4                   | 8.0990     | 8.2400     | 6.5811    | 7.5706    |
| population parallel (explicit pool), n = 1e4 | 195.8059   | 197.8315   | 141.8017  | 142.5501  |
| population serial, n = 1e5                   | 71.5959    | 71.2844    | 53.1186   | 54.6393   |
| population parallel (explicit pool), n = 1e5 | 258.7916   | 255.1549   | 179.0449  | 174.3249  |

**A/A control** (two distinct serial closures, n = 1e4), ratio over five runs: Node
**0.9952–1.0017**, Bun **0.9874–1.0196** (both inside ±2% on this VM).

---

## Worker threshold from a measurement (`SCALAR_PARALLEL_MIN_ROWS`) — SR-14

SR-14 of [`docs/plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md`](./plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md)
ran SR-11 case (3) (`evaluateScalarPopulation`, serial vs an explicit injected
`WorkerPool`, 8 items, mid tree) **twice on Node and twice on Bun**, in fresh
processes, on the same Linux x64 VM (Node v22.23.4, Bun 1.4.4, 2026-11-05).
Medians, ms; ratio = parallel / serial:

| rows    | Node run 1 serial / parallel (ratio) | Node run 2 serial / parallel (ratio) | Bun run 1 serial / parallel (ratio) | Bun run 2 serial / parallel (ratio) |
| ------- | ------------------------------------ | ------------------------------------ | ----------------------------------- | ----------------------------------- |
| 100     | 0.1553 / 192.6389 (1240.67)          | 0.1700 / 205.1413 (1206.93)          | 0.1720 / 158.0239 (918.71)          | 0.1814 / 177.5374 (978.80)          |
| 1 000   | 0.8294 / 198.1899 (238.95)           | 0.8224 / 206.2181 (250.76)           | 0.6757 / 175.4657 (259.70)          | 0.6322 / 173.2358 (274.01)          |
| 10 000  | 8.3725 / 211.2120 (25.23)            | 9.7276 / 217.2928 (22.34)            | 7.5117 / 184.9894 (24.63)           | 6.4055 / 178.4875 (27.86)           |
| 100 000 | 77.2345 / 285.5914 (3.70)            | 74.2252 / 287.5741 (3.87)            | 58.1985 / 211.3895 (3.63)           | 57.2462 / 220.9834 (3.86)           |

A/A control (two distinct serial closures, n = 1e4), one run per process: Node
**1.0054** and **0.9994**, Bun **0.9925** and **0.9923** — all inside ±2%.

**Decision: no row on the grid qualifies.** The rule requires the worker path's
median to be at or below 0.95× serial in all four runs at some row count, with
the row count below it not qualifying. The smallest ratio observed anywhere is
**3.63× (Bun run 1, n = 1e5)** — far above 1.0, let alone 0.95. The parallel
median carries a near-constant ~130–210 ms per call from creating the explicit
`WorkerPool` and terminating it (worker spawn dominates every row on the grid),
while serial scoring of even 100 000 rows takes under 80 ms.

Consequently `SCALAR_PARALLEL_MIN_ROWS` stays at **100** in
`functions/src/scalar-batch-parallel.ts`; no changeset. Bun started
`worker_threads` normally in all four runs (no startup failure to record).
The seed-7 pinned search matched `pinned-rows.json` with `Object.is` before
timing in all four runs. This measures the explicit-pool path of case (3) only;
no speedup is claimed for `searchScalars` as a whole.
