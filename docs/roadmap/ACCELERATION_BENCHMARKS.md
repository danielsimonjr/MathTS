# Parallel Acceleration Benchmarks

This document records the first measured comparison of the worker-pool parallel
acceleration (`@danielsimonjr/mathts-parallel`'s `ComputePool`) against the
sequential baseline, and derives **per-operation `thresholdElements`
recommendations** to replace the current flat guess.

## Executive Summary

Until now no part of the worker-pool acceleration had ever been benchmarked,
and `ComputePool` gates sequential-vs-parallel dispatch with a single
`thresholdElements = 50000` — the **same guessed number for every operation**.
This work adds a reusable benchmark harness (`tools/benchmark/parallel/`) and
reports the first measured numbers.

**Key findings (this environment — see caveats):**

- **Compute-bound operations win, and win big.** `matmul` reaches **3.6x** at
  512x512; the matrix decompositions (`matrixPower`,
  `characteristicPolynomial`) win from ~96x96 upward. These are O(n^3)-O(n^4)
  in work but only O(n^2) in data transferred, so worker dispatch pays off.
- **Transfer-bound element-wise operations never win.** `add`, `multiply`,
  `sin`, `exp`, `sign`, `normalCDF` were **never faster in parallel at any
  tested size** (up to 1e6 elements). The per-element work is a single cheap
  arithmetic/transcendental op; the cost is dominated by copying the
  `Float64Array` to and from workers. The current 50000 threshold makes these
  _slower_, not faster.
- **Reductions never reliably win either.** `sum`, `mean`, `variance`,
  `parallelStatProd` showed only sporadic one-off "wins" at 1e4 (within noise)
  and were slower at 1e5 and 1e6. A reduction transfers O(n) data to compute an
  O(n) sum — the same transfer-bound problem.
- **Special functions win only when the per-element kernel is expensive
  enough.** `erfc` wins from 1e5 (1.4x at 1e6). `besselJ` barely crosses
  break-even (1.02x) only at 1e6.
- **Signal operations are mixed.** `spectrogram` and `fft2d` cross over near
  their largest tested sizes (~1.05-1.1x); `parallelFFT` and `parallelConv`
  never reliably win.

**Bottom line:** the flat 50000 threshold is wrong for almost every operation.
It is far too low for transfer-bound element-wise/reduction ops (which should
effectively never be parallel-dispatched in this environment) and, expressed in
element count, too high for `matmul` (which wins from a 64x64 = 4096-element
matrix).

## Methodology

- **Harness:** `tools/benchmark/parallel/harness.ts` — a reusable
  `BenchCase`/`runCase` framework. Cases are defined in
  `operations.bench.ts`; the runner is `run.ts`
  (`npm run bench:parallel`).
- **Forcing each path.** Both paths run the _same_ operation; only
  `ComputePool`'s `thresholdElements` differs:
  - **sequential** — `thresholdElements = Number.MAX_SAFE_INTEGER`, so every
    input falls below threshold and runs on-thread.
  - **parallel** — `thresholdElements = 1`, so any non-trivial input
    dispatches to the worker pool.
- **Timing.** `performance.now()`, 2 warm-up runs, then several timed
  iterations (more for small inputs, fewer for large). The **median** is
  reported — robust against scheduler jitter.
- **Sizes.** A geometric ladder per operation: element count for element-wise
  and reductions (1e3-1e6); square matrix dimension for `matmul` (32-512) and
  decompositions (16-128); sample count for signal ops; point count for
  `distanceMatrix`.
- **Break-even definition.** The smallest tested size from which parallel wins
  **and keeps winning at every larger tested size**. A single non-persistent
  "win" (common noise artifact) does _not_ count — a threshold set at a
  non-persistent crossover would be wrong.
- **Fresh inputs per run** so the JIT cannot hoist the work.

### Environment

| Field            | Value                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| Logical CPUs     | 4 (`ComputePool` maxWorkers = 4)                                               |
| Node             | v22.22.x                                                                       |
| Worker transport | real `worker_threads` (verified: pool spawns 4 workers, `parallelized = true`) |

## Caveats — read before trusting these numbers

- **This is a contended CI container** — few cores, noisy neighbours,
  background load. The absolute milliseconds and the exact crossover points
  are **indicative, not authoritative**. Speedups within roughly +/-20% of 1.0x
  are inside the noise floor and should be treated as "no clear winner".
- **The harness is the durable deliverable.** The numbers below are a
  hardware-specific snapshot. Re-run `npm run bench:parallel` on the target
  deployment hardware before adopting any threshold as a production constant.
- **WASM is out of scope.** The `.wasm` artifacts are not built in this
  environment, so the WASM-accelerated `spectrogram` fast path and any
  WASM-vs-worker comparison are deliberately not measured here.
- **Worker-pool warm-up cost is real and fixed.** The parallel path carries a
  near-constant ~1.5-3 ms overhead (worker dispatch + serialization round
  trip) regardless of input size. That floor is why small inputs always lose
  and is the dominant factor in every "never wins" verdict below.

## Measured Results

Times are median ms. `speedup = seq / par`; `> 1.0` means parallel is faster.

### Element-wise — size = element count

| operation | 1e3   | 1e4   | 1e5   | 1e6   | break-even |
| --------- | ----- | ----- | ----- | ----- | ---------- |
| add       | 0.34x | 0.49x | 0.61x | 0.56x | **never**  |
| multiply  | 0.39x | 0.38x | 0.88x | 0.67x | **never**  |
| sin       | 0.47x | 0.34x | 0.67x | 0.57x | **never**  |
| exp       | 0.45x | 0.48x | 1.05x | 0.81x | **never**  |
| sign      | 0.37x | 0.29x | 0.51x | 0.43x | **never**  |

Every element-wise op is transfer-bound: one cheap op per element, dominated by
copying the array in and out of workers. None crosses break-even up to 1e6.

### Distribution / special functions — size = element count

| operation | 1e3   | 1e4   | 1e5   | 1e6   | break-even |
| --------- | ----- | ----- | ----- | ----- | ---------- |
| normalCDF | 0.73x | 0.40x | 0.83x | 0.74x | **never**  |
| erfc      | 0.49x | 0.51x | 1.32x | 1.40x | **1e5**    |
| besselJ   | 0.26x | 0.69x | 0.84x | 1.02x | **1e6**    |

`erfc` has an expensive enough per-element kernel (error-function series) to
overcome transfer cost from 1e5. `besselJ` only barely crosses at 1e6.
`normalCDF` (also error-function based) did not cross — close to the noise
floor; it would likely need >1e6 elements to pay off.

### Reductions — size = element count

| operation        | 1e3   | 1e4   | 1e5   | 1e6   | break-even |
| ---------------- | ----- | ----- | ----- | ----- | ---------- |
| sum              | 0.22x | 1.16x | 0.43x | 0.56x | **never**  |
| mean             | 0.32x | 1.74x | 0.94x | 0.77x | **never**  |
| variance         | 0.38x | 1.51x | 0.99x | 0.74x | **never**  |
| parallelStatProd | 0.35x | 1.13x | 0.57x | 0.48x | **never**  |

The 1e4 "wins" are **not persistent** — every reduction is slower at 1e5 and
1e6 — so they are noise, not a real crossover, and the break-even is correctly
reported as `never`. A reduction moves O(n) data to produce an O(n)-cost
scalar: the same transfer-bound problem as element-wise ops.

### Linear algebra — size = square matrix dimension

| operation                | 32    | 64    | 96    | 128   | 256   | 512   | break-even |
| ------------------------ | ----- | ----- | ----- | ----- | ----- | ----- | ---------- |
| matmul                   | 0.26x | 1.03x | –     | 1.62x | 3.14x | 3.61x | **64x64**  |
| matrixPower              | 0.22x | 0.69x | 1.12x | 1.46x | –     | –     | **96x96**  |
| characteristicPolynomial | 0.13x | 0.48x | 1.23x | 1.66x | –     | –     | **96x96**  |

This is where worker dispatch pays off. `matmul` is O(n^3) work on O(n^2) data;
the decompositions call `matmul` repeatedly. The speedup _grows_ with size
(`matmul` 3.6x at 512x512), the hallmark of a genuinely compute-bound op.

### Signal — size = samples (or image side for `fft2d`)

| operation    | sizes tested        | best speedup                   | break-even         |
| ------------ | ------------------- | ------------------------------ | ------------------ |
| parallelFFT  | 1024-262144 samples | 0.53x @ 65536                  | **never**          |
| parallelConv | 512-131072 samples  | 1.16x @ 32768 (not persistent) | **never**          |
| spectrogram  | 4096-262144 samples | 1.03x @ 262144                 | **262144 samples** |
| fft2d        | 32-256 image side   | 1.09x @ 256x256                | **256x256**        |

`parallelFFT` and `parallelConv` never reliably win — a single radix-2 FFT is
memory-bandwidth-bound and the four-step decomposition's transposes add
transfer cost. `spectrogram` and `fft2d` (many _independent_ FFTs) only just
cross over at their largest tested sizes; the speedup is marginal (~1.05x) and
inside the noise floor, so the break-even should be treated as a lower bound,
not a firm number.

### Geometry — size = point count

| operation      | 64    | 128   | 256   | 512   | 1024  | break-even |
| -------------- | ----- | ----- | ----- | ----- | ----- | ---------- |
| distanceMatrix | 0.47x | 0.15x | 0.50x | 1.23x | 0.88x | **never**  |

The 512-point "win" did not persist to 1024 points, so it is reported as
`never`. `distanceMatrix` builds an n*n output; transferring that result back
from workers competes with the O(n^2 * dim) compute.

## Recommended `thresholdElements` (vs. current flat 50000)

`ComputePool.shouldParallelize(elementCount)` compares an **element count**
against `thresholdElements`. For square-matrix / point-count operations the
element count is the side squared (`matmul` gates on `rows*cols`;
`distanceMatrix` builds an n\*n matrix). The recommendations below are expressed
in those element-count terms.

| operation                | current | recommended `thresholdElements`   | rationale                                      |
| ------------------------ | ------- | --------------------------------- | ---------------------------------------------- |
| add                      | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; never wins to 1e6              |
| multiply                 | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; never wins to 1e6              |
| sin                      | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; never wins to 1e6              |
| exp                      | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; one stray 1.05x is noise       |
| sign                     | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; never wins to 1e6              |
| normalCDF                | 50000   | `MAX_SAFE_INTEGER` (never)        | did not cross to 1e6 in this run               |
| erfc                     | 50000   | **~100000**                       | persistent win from 1e5                        |
| besselJ                  | 50000   | **~1000000**                      | only crosses (barely) at 1e6                   |
| sum                      | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; 1e4 "win" not persistent       |
| mean                     | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; 1e4 "win" not persistent       |
| variance                 | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; 1e4 "win" not persistent       |
| parallelStatProd         | 50000   | `MAX_SAFE_INTEGER` (never)        | transfer-bound; 1e4 "win" not persistent       |
| matmul                   | 50000   | **~4096** (64x64)                 | compute-bound; wins from 64x64, scales to 3.6x |
| matrixPower              | 50000   | **~9216** (96x96)                 | persistent win from 96x96                      |
| characteristicPolynomial | 50000   | **~9216** (96x96)                 | persistent win from 96x96                      |
| parallelFFT              | 50000   | `MAX_SAFE_INTEGER` (never)        | bandwidth-bound; never wins to 262144          |
| parallelConv             | 50000   | `MAX_SAFE_INTEGER` (never)        | 32768 "win" not persistent                     |
| spectrogram              | 50000   | **~262144** (lower bound)         | marginal crossover at largest size tested      |
| fft2d                    | 50000   | **~65536** (256x256, lower bound) | marginal crossover at largest size tested      |
| distanceMatrix           | 50000   | `MAX_SAFE_INTEGER` (never)        | 512-point "win" not persistent                 |

### Interpretation

- The single most actionable change: **lower `matmul`'s threshold and raise
  almost everything else's.** `matmul` is the one operation where parallel
  dispatch is unambiguously worth it, and it wins from a much smaller size
  (4096 elements) than the flat 50000 allows. Conversely, every element-wise
  and reduction op at 50000 elements is being made _slower_ by the current
  threshold.
- "never" recommendations mean: in _this_ environment the operation should not
  be worker-dispatched. Per-operation thresholds are not yet a feature of
  `ComputePool` (it has one global `thresholdElements`); realising these
  recommendations would require either per-operation threshold support or
  simply not routing transfer-bound ops through the pool. **That is a
  follow-up; this document only measures and recommends — it changes no
  acceleration code.**
- The marginal signal-op crossovers (`spectrogram`, `fft2d`) are within the
  noise floor. Treat their thresholds as lower bounds and re-measure on real
  hardware before relying on them.

## Reproducing

```bash
# Build the functions package so the bench imports the built dist/
npx turbo build --filter=@danielsimonjr/mathts-functions

# Run the full suite
npm run bench:parallel

# Run a subset by operation name
npx tsx tools/benchmark/parallel/run.ts matmul erfc sum
```

Harness files:

- `tools/benchmark/parallel/harness.ts` — timing primitives, threshold control,
  `runCase`, reporting.
- `tools/benchmark/parallel/operations.bench.ts` — the `BenchCase` definitions.
- `tools/benchmark/parallel/run.ts` — runner / CLI entry point.

---

## Tensor Primitives Baseline (Slice 1.6)

**Date captured:** 2026-05-24
**Suite:** `npm run bench:tensor` (wall time ≈ 25 s)
**Runner:** `npx tsx tools/benchmark/tensor/*.bench.ts`

These numbers establish the **JS-only baseline** for the ITensor-parity surface
(`Tensor.contract`, `contractNetwork`, `Tensor.tensordot`, and the decomposition
trio). Future WASM/GPU acceleration should show a speedup in these tables.

### Environment

Same container as the parallel bench above (4 logical CPUs, Node v22.22.x).

### Methodology

- `performance.now()` timing, `Math.min(2, iterations)` warmup runs, then
  `iterations` timed runs; average reported.
- Iteration counts tuned to keep each bench file ≤ ~10 s wall time.
- No WASM or GPU paths are active; all computation is pure TypeScript einsum.

### Caveats

The pure-JS einsum is O(n^K) where K depends on the number of free + contracted
axes. At the sizes shown (n ≤ 32 for rank-3 operations, n ≤ 64 for eig on
rank-2) GFLOPS are around 0.01 — deliberately low; these numbers are a
correctness/regression baseline, not a performance target. Future WASM
kernels should raise throughput by 10–100x.

### Tensor.contract (3-D × 3-D, 1 shared axis)

Benchmarks `Tensor.contract` on two `[n, n, n]` tensors sharing one named Index.
Output shape is `[n, n, n, n]`; FLOPs ≈ 2·n⁵.

| Edge dim (n) |    ms/op | GFLOPS |
| :----------: | -------: | -----: |
|      8       |    7.150 |  0.009 |
|      16      |  221.294 |  0.009 |
|      24      | 1639.081 |  0.010 |

At n=32 (expected ≈ 7000 ms/op) the pure-JS path becomes impractical;
the bench caps at n=24 to stay within budget. This is the primary
regression guard: a WASM matmul-routed contraction should reduce this to
< 100 ms at n=32.

### contractNetwork (MPS chain, bond_dim=2, phys_dim=2)

Benchmarks both contraction-order algorithms on a linear MPS chain.

| N tensors | exact ms/op | greedy ms/op | exact/greedy ratio |
| :-------: | ----------: | -----------: | -----------------: |
|     4     |       0.158 |        0.081 |               1.95 |
|     8     |       0.918 |        0.397 |               2.31 |
|    12     |      17.434 |        3.702 |               4.71 |
|    16     |         n/a |       53.682 |                n/a |

The exact-DP algorithm is O(3^N) in subset enumeration. At N=12 it is
~5x slower than greedy; at N=16 the combination of DP planning + actual
tensor contractions was too slow to time reliably on this hardware. The
greedy result at N=16 (54 ms) is the regression guard for the O(N^3)
heuristic path.

### Tensor.tensordot (3-D × 3-D, 1-axis and 2-axis)

| Size (n) | Axes |    ms/op | GFLOPS |
| :------: | :--: | -------: | -----: |
|    8     |  1   |    7.126 |  0.009 |
|    16    |  1   |  222.168 |  0.009 |
|    24    |  1   | 1648.293 |  0.010 |
|    8     |  2   |    0.987 |  0.008 |
|    16    |  2   |   15.008 |  0.009 |
|    24    |  2   |   75.062 |  0.009 |
|    32    |  2   |  238.434 |  0.009 |

1-axis at n=32 (≈ 7000 ms) is excluded from the timed suite; 2-axis is
O(n⁴) and tractable to n=32.

### tensorQr (shape [n, n, n], rowAxes=[0])

Effective matrix: n × n² (thin QR).

|  n  | ms/op |
| :-: | ----: |
|  8  | 0.286 |
| 16  | 0.413 |
| 32  | 3.648 |

### tensorSvd (truncated, shape [n, n, n], rowAxes=[0])

|  n  | maxdim |   ms/op |
| :-: | :----: | ------: |
|  8  |   2    |   0.422 |
|  8  |   4    |   0.406 |
| 16  |   4    |   7.894 |
| 16  |   8    |   7.934 |
| 32  |   8    | 221.159 |
| 32  |   16   | 229.140 |

SVD time at n=32 is dominated by the underlying Householder/Golub-Reinsch
on a 32 × 1024 matrix. Truncation (maxdim) has minimal impact once the
full SVD is computed.

### tensorEig (symmetric, shape [n, n])

|  n  |  ms/op |
| :-: | -----: |
|  8  |  0.291 |
| 16  |  0.457 |
| 32  |  2.571 |
| 64  | 24.994 |

Symmetric eigensolver scales well to n=64. The n=64 number is the primary
regression guard here.

## Reproducing the tensor suite

```bash
npm run bench:tensor
```

Bench files (each is a standalone tsx script):

- `tools/benchmark/tensor/contract.bench.ts` — `Tensor.contract`
- `tools/benchmark/tensor/contract-network.bench.ts` — `contractNetwork` (exact + greedy)
- `tools/benchmark/tensor/tensordot.bench.ts` — `Tensor.tensordot` (1-axis, 2-axis)
- `tools/benchmark/tensor/decompositions.bench.ts` — `tensorQr`, `tensorSvd`, `tensorEig`
