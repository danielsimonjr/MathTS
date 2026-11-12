# Persona session: performance engineer (2026-11-12, round 2)

Label: `persona:performance-engineer`. Round 2 dogfood on **published npm** (release `cb254e81`). I did not patch MathTS.

## Goal

Re-evaluate MathTS for a latency-sensitive Node and browser product after the A-Team Relay fixes (#688–#878): throughput, GC, cold-start, install/bundle size, tree-shaking, parallel/WASM tiers, determinism. Re-run the round-1 harness against registry packages and re-check every round-1 issue in my area.

## Environment

- Scratch ESM project: `/tmp/mathts-perf-dogfood-r2` (outside repo). Pinned versions per owner list (confirmed with `npm ls`).
- Node v22.23.4, linux x64, 4-core Intel Xeon KVM, `node --expose-gc`.
- Competitors: mathjs 15.2.0, ml-matrix 6.15.1, fft.js 4.0.4.
- Harness: `docs/persona-sessions/bench/2026-11-12-performance-engineer-r2.harness.mjs.txt` (rename to `.mjs` to run; kept as text so it is not counted as repo source, same as the round 1 robustness harness) → JSON `docs/persona-sessions/bench/2026-11-12-performance-engineer-r2.json`.
- Re-run against npm: `cd <scratch> && npm i … && node --expose-gc harness-r2.mjs` (copy harness from docs tree; use scratch `node_modules`).

Published versions exercised:

| package             | version         |
| ------------------- | --------------- |
| functions           | 0.85.0          |
| matrix              | 0.10.1          |
| core                | 0.27.0          |
| linalg              | 0.2.6           |
| tensor              | 0.4.0           |
| parallel            | 0.10.1          |
| expression          | 0.13.0          |
| signal / statistics | 0.1.87 / 0.4.15 |

## What I tried, in order

1. Installed the pinned graph in scratch; verified no version skew.
2. Re-ran round-1 reprobes (`round1-recheck.mjs`) for #704–#712, #692/#693.
3. Re-ran the full round-1 harness (import timing, esbuild bundles, warmup+median/p95 benches, WASM, ComputePool, determinism).
4. Measured **new** bundle paths: `functions/evaluate` subpath vs barrel vs `@danielsimonjr/mathts-expression`; esbuild `platform=neutral`.
5. Cross-checked `docs/BENCHMARK_RESULTS.md` (WASM sin row) and repo performance narrative.
6. Filed new/regression issues (labels in body; token cannot apply labels). Could not comment on open #893 (403).

## Round-1 re-check

| Issue | Title (short)                                  | Fixed?                                                                                                                                       |
| ----: | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
|   704 | `svd(DenseMatrix)` silent empty                | **yes** — rank>0, non-empty `S`                                                                                                              |
|   705 | `lu(number[][])` throws                        | **yes**                                                                                                                                      |
|   706 | `fft` rejects Float64Array                     | **yes** — `fft` + `parallelFFT` accept typed arrays                                                                                          |
|   707 | Named `{evaluate}` bundle ~1.13 MB             | **partial / no** — subpath exists but still ~1.18 MB ([#930](https://github.com/danielsimonjr/MathTS/issues/930))                            |
|   708 | Browser esbuild neutral (Node builtins)        | **no** — workerpool `child_process`/`worker_threads`/`os` ([#893](https://github.com/danielsimonjr/MathTS/issues/893) open; comment blocked) |
|   709 | `ComputePool.matmul` arity error dumps MB JSON | **yes** — short error                                                                                                                        |
|   710 | `ComputePool.sin` parallelized false at 1e6    | **no** — same behavior ([#931](https://github.com/danielsimonjr/MathTS/issues/931))                                                          |
|   711 | `loadWasm()` does not speed `sin`              | **yes (marginal)** — ~1.2–1.3× after load on n=1e5                                                                                           |
|   712 | `sort`/`median` cliffs                         | **yes** — sort ≈ native sort; median 36 ms vs 118 ms r1                                                                                      |
|   692 | `sin` rejects `number[]`                       | **yes**                                                                                                                                      |
|   693 | `DenseMatrix.multiply` slower than ml-matrix   | **yes** — 1024: **457 ms vs 689 ms** (MathTS faster)                                                                                         |

## Findings (round 2)

1. **P1** [#930](https://github.com/danielsimonjr/MathTS/issues/930) — `functions/evaluate` subpath does not shrink bundle (~1.18 MB); `@danielsimonjr/mathts-expression` is **255 KB** and neutral-esbuild-safe.
2. **P1** [#931](https://github.com/danielsimonjr/MathTS/issues/931) — `ComputePool.sin` still `parallelized: false` and slower than in-process `sin` at 1e6.
3. **P2** [#932](https://github.com/danielsimonjr/MathTS/issues/932) — `svd(DenseMatrix)` n=500 ~26% slower than nested `number[][]` (correct but costly).
4. **P2** [#933](https://github.com/danielsimonjr/MathTS/issues/933) — public `fft(number[])` at 2^16 ~1.6× fft.js; `parallelFFT` wins.
5. **P2** [#934](https://github.com/danielsimonjr/MathTS/issues/934) — `BENCHMARK_RESULTS.md` sin 0.32× WASM row vs ~1.2× public path after `loadWasm()`.
6. **P2** [#935](https://github.com/danielsimonjr/MathTS/issues/935) — `ComputePool.matmul` at n=256 ~3.5× slower than `DenseMatrix.multiply`.

## Headline table vs round 1 (median ms unless noted)

| Workload                  | Round 2 (0.85.0) | Round 1 (0.84.0) | Notes                                                                      |
| ------------------------- | ---------------: | ---------------: | -------------------------------------------------------------------------- |
| Cold import functions     |              429 |              396 | Still heavy                                                                |
| Bundle `{evaluate}` bytes |        1,192,739 |        1,131,967 | Slight growth; expression **254,686**                                      |
| matmul 1024 DenseMatrix   |          **457** |             1216 | Major win vs ml-matrix 689 (was 671)                                       |
| lu+solve 500              |             60.2 |             49.5 | Still ≫ faster than mathjs 511                                             |
| median 1e6                |         **36.2** |            117.8 | Fixed tier                                                                 |
| sort 1e5                  |         **6.49** |  24.7 (r1 issue) | Near `Float64Array.sort`                                                   |
| FFT 2^16 public `fft`     |             8.50 |             8.59 | Still loses to fft.js 5.36                                                 |
| FFT 2^16 `parallelFFT`    |         **2.92** |             4.97 | Improved                                                                   |
| `svd(DenseMatrix)` 500    |            10474 |     silent empty | Correct, slow ([#932](https://github.com/danielsimonjr/MathTS/issues/932)) |

## Doc cross-check

- **`docs/BENCHMARK_RESULTS.md`**: WASM elementwise table still shows `sin` **0.32×** at 1e6 — does not match consumer `loadWasm()` + public `sin` (~1.2×) ([#934](https://github.com/danielsimonjr/MathTS/issues/934)).
- **Browser bundling**: neutral esbuild still fails on workerpool Node builtins; expression-only path bundles cleanly (related #893).

## Determinism

Scalar `evaluate`, `svd` nested 32, `fft` 256, matmul 64: bit-identical across paired calls. `svd(DenseMatrix)` now returns non-empty, deterministic singular values (no more silent rank-0).

## Verdict

The 0.27/0.85 train fixed several round-1 blockers I care about: **correct SVD on `DenseMatrix`**, **lu on nested arrays**, **typed FFT inputs**, **dramatically faster public matmul vs ml-matrix**, and **sort/median cliffs**. WASM `loadWasm()` gives a small `sin` win, not the 3× implied by `BENCHMARK_RESULTS.md`.

I still would not default to `@danielsimonjr/mathts-functions` for browser evaluate: use **`@danielsimonjr/mathts-expression`** for bundle size, avoid `ComputePool` for `sin` and small matmul, and call **`parallelFFT`** instead of factory `fft` when latency matters. Neutral esbuild of matrix/functions remains blocked (#893 / #708).

GPU: not measured (no WebGPU adapter in this VM).
