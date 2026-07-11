# WebGPU Accelerator ↔ Function Pairing

**Generated**: 2026-07-11 (by tools/create-dependency-graph)

The GPU analog of `wasm-pairing.md`. Per public `mathTyped` function in `functions/src/typed/`, whether it routes to a **WebGPU** path — detected via a `*GpuDispatch` bridge (mirroring the `*Dispatch` WASM convention) or a GPU pool/backend reference (`gpuPool` / `getGlobalGPUBackend` / `GPUBackend`).

> **Status:** No WebGPU accelerators are wired into the functions typed layer yet — forward-looking tracker (see ROADMAP "WebGPU acceleration tier"). Auto-populates when a function routes to a \*GpuDispatch bridge or a GPU pool/backend.

> WebGPU is an experimental, flag-gated future tier (browser only). `matrix`'s `GPUBackend.matmul` is the experimental starting point; it is NOT counted here (it lives in the matrix backend, not the functions typed dispatch). Bench harness: `tools/benchmark/gpu/bench-3way.*`.

| Routing (static) |   Count |
| ---------------- | ------: |
| WebGPU           |       0 |
| None             |     218 |
| **Total**        | **218** |

## Per-module counts

| Module        | WebGPU | None |
| ------------- | -----: | ---: |
| arithmetic    |      0 |   45 |
| bitwise       |      0 |    7 |
| combinatorics |      0 |   21 |
| complex       |      0 |    4 |
| distributions |      0 |   14 |
| logical       |      0 |    5 |
| matrix-ops    |      0 |    9 |
| probability   |      0 |    8 |
| relational    |      0 |    7 |
| set           |      0 |   10 |
| signal        |      0 |    7 |
| special       |      0 |   38 |
| statistics    |      0 |   17 |
| string        |      0 |    5 |
| trigonometry  |      0 |   19 |
| unit          |      0 |    2 |
