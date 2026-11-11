# Persona session: performance engineer (2026-11-11)

Label: `persona:performance-engineer`. Round 1 dogfood. I did not patch MathTS.

## Goal

I am evaluating published MathTS for a latency-sensitive Node and browser product: throughput, allocation/GC, cold-start and import time, install and bundle size, tree-shaking, whether parallel/WASM/GPU fast paths actually run, and run-to-run determinism. Competitors: mathjs 15.2.0, ml-matrix 6.15.1, fft.js 4.0.4.

## Environment

- Scratch ESM project at `/tmp/mathts-perf-dogfood` (outside the repo). `npm i @danielsimonjr/mathts-*@latest` plus competitors. No repo build.
- Node v22.23.4, Bun not on PATH (`bun: command not found`).
- Linux x64, 4-core Intel Xeon (KVM). `--expose-gc`.
- Repo SHA for “reproduces on master” greps: `f970c4bee077ea00afc31ae290ce8ac3c8a174e9`.
- Published: functions 0.84.0, matrix 0.10.0, linalg 0.2.5, tensor 0.3.5, parallel 0.10.0, signal 0.1.86, statistics 0.4.14, expression 0.12.7, core 0.26.0, gpu 0.2.1.
- Harness: `docs/persona-sessions/bench/2026-11-11-performance-engineer.mjs` (re-run: `node --expose-gc harness.mjs`). Numbers: `docs/persona-sessions/bench/2026-11-11-performance-engineer.json`.

## What I tried, in order

1. Installed the published graph and probed exports. `evaluate` / `compileExpr` / `parse` / `fft` / `parallelFFT` / `loadWasm` / `enableGpu` exist on functions. `@danielsimonjr/mathts-signal` has `parallelFFT` and `fourier` but **no `fft`**. `DenseMatrix` stores `cols`, not `columns`.
2. Smoke-tested types. `svd(DenseMatrix)` returned empty rank 0; `svd(number[][])` worked. `lu` was the inverse. `fft(Float64Array)` threw; `parallelFFT` is async `{real, imag}`. `sin(number[])` threw; `add(number[])` worked.
3. esbuild named vs star imports (platform node after neutral failed on `fs`/`crypto`).
4. Import timing in 7 fresh processes.
5. Warmup + median/p95/variance benches: scalar evaluate, elementwise 1e5/1e6, matmul 128/512/1024, lu/SVD 500, FFT 2^16 and 2^20, stats 1e6, sort, tensor broadcast, ComputePool, `loadWasm`.
6. Cross-checked `docs/BENCHMARK_RESULTS.md` and `docs/performance.md`.
7. Opened issues for new findings. Could not add labels (`403` on `gh label create`) or comment on duplicates (`403` on `addComment`). Related open issues: #693, #692, #701, #699, #431 (closed, tables still stale). Accidental permission probe left as #703 (cannot close).

## Findings

1. **P0** [#704](https://github.com/danielsimonjr/MathTS/issues/704) — `svd(DenseMatrix)` silently returns `{U:[],S:[],V:[],rank:0}`. Nested arrays are correct. Reproduces on master (`svd.ts` only accepts `number[][] | Float64Array`).
2. **P1** [#705](https://github.com/danielsimonjr/MathTS/issues/705) — `lu(number[][])` throws `A.toFloat64Array is not a function`. DenseMatrix lu+solve n=500: **49.5 ms** vs mathjs **525 ms**.
3. **P1** [#706](https://github.com/danielsimonjr/MathTS/issues/706) — `fft` rejects Float64Array; `parallelFFT` requires it; signal package does not export `fft`. Public `fft` loses to fft.js at 2^16 (8.6 vs 3.7 ms); `parallelFFT` wins at 2^20 (62 vs 91 ms).
4. **P1** [#707](https://github.com/danielsimonjr/MathTS/issues/707) — `{ evaluate }` minify bundle **1.13 MB** (mathjs 0.67 MB). functions cold import **396 ms**.
5. **P1** [#708](https://github.com/danielsimonjr/MathTS/issues/708) — published core/matrix statically import Node `fs`/`crypto`/`util`; esbuild `platform:neutral` fails.
6. **P2** [#709](https://github.com/danielsimonjr/MathTS/issues/709) — `ComputePool.matmul` wrong arity dumps the entire operand into the error (3.8 MB JSON). Correct arity: 25.4 ms, `parallelized: true`, **chunks: 1**, no win vs DenseMatrix 26.1 ms.
7. **P1** [#710](https://github.com/danielsimonjr/MathTS/issues/710) — `ComputePool.sin(1e6)` is `parallelized: false` and slower than in-process `sin` (6.29 vs 4.83 ms). Pool can leave the process running.
8. **P1** [#711](https://github.com/danielsimonjr/MathTS/issues/711) — `loadWasm()` is a no-op on public `sin` at n=1e5 (0.598 → 0.582 ms) while BENCHMARK_RESULTS still shows AS sin 0.32× at 1e6. Policy band disagrees with the historical table (#431 closed, file still contradictory).
9. **P1** [#712](https://github.com/danielsimonjr/MathTS/issues/712) — `sort` 1e5 is 3.7× `Float64Array.sort`; `median` 1e6 is 118 ms vs `mean` 0.46 ms.
10. **P1** (duplicate of [#693](https://github.com/danielsimonjr/MathTS/issues/693), comment blocked) — `DenseMatrix.multiply` 1024 is 1.81× slower than ml-matrix; WASM GEMM via `backendManager` is 3.75× faster than the public method at 512. Fast path is not the default API.
11. **P1** (duplicate of [#692](https://github.com/danielsimonjr/MathTS/issues/692)) — `sin` rejects `number[]`; `add` does not.
12. **P2** — `enableGpu()` is exported; this Node VM has no WebGPU adapter, so GPU was not timed (honest skip, not a silent win).

Determinism (same inputs, two calls): evaluate, svd nested 32, fft 256, matmul 64 were bit-identical. SVD-on-DenseMatrix “deterministically” empty.

## Headline table (median ms unless noted)

| Workload                              |                    MathTS |  mathjs |         ml-matrix | fft.js |
| ------------------------------------- | ------------------------: | ------: | ----------------: | -----: |
| Scalar `evaluate('2+3*4-sin(0.5)^2')` |                     0.003 |   0.022 |                 — |      — |
| Compiled evaluate                     |                     0.002 |   0.002 |                 — |      — |
| add 1e5 `number[]`                    |                      0.71 |    7.95 |                 — |      — |
| sin 1e5 Float64Array                  |                      0.60 |       — |                 — |      — |
| mean 1e6                              |                      0.46 |    9.78 |                 — |      — |
| median 1e6                            |                     117.8 |       — |                 — |      — |
| matmul 128                            |                      2.35 |    6.33 |              1.96 |      — |
| matmul 512                            |     154.4 (WASM mgr 41.2) |       — |              86.9 |      — |
| matmul 1024                           |                      1216 |       — |               671 |      — |
| lu+solve 500                          |        49.5 (DenseMatrix) |     525 |                 — |      — |
| svd nested 128                        |                       114 |       — |                 — |      — |
| svd nested 500                        |                      8362 |       — |                 — |      — |
| FFT 2^16                              | 8.59 (`parallelFFT` 4.97) |     762 |                 — |   3.73 |
| FFT 2^20                              |  254 (`parallelFFT` 62.0) |       — |                 — |   91.5 |
| Cold import functions                 |                       396 |     319 |    16 (ml-matrix) |    3.9 |
| Minify `{evaluate}` bytes             |                 1,131,967 | 671,231 | 71,158 (`Matrix`) |  5,090 |

## Verdict

MathTS is already faster than mathjs on scalar evaluate, vector add, mean, and lu+solve **if you pick the packed types**. It is **not** a drop-in latency win: the default `DenseMatrix.multiply` loses to ml-matrix by ~1.8×; WASM GEMM is hidden behind `backendManager`; public `fft` loses to fft.js and rejects typed arrays; `svd(DenseMatrix)` is a silent zero; `loadWasm()` did not move `sin`; workers did not help `sin`; a named `evaluate` import is fatter and slower to start than mathjs. I would not ship the default barrels into a browser bundle until #708/#707 are fixed, and I would not call `svd` on the matrix type the rest of the API returns.

GPU: not measured (no adapter). Bun: not installed in this environment.
