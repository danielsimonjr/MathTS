# WebGPU Accelerator ↔ Function Pairing

**Generated**: 2026-07-14 (by tools/create-dependency-graph)

The GPU analog of `wasm-pairing.md`. Which functions route to a **WebGPU** path — detected via a `*GpuDispatch` bridge (mirroring the `*Dispatch` WASM convention) or a direct GPU backend/device reference (`GPUBackend` / `gpuMatrixBackend` / `getGpuDevice`).

> **Status:** 6 standalone function(s) route to WebGPU; 0 of 218 typed-dispatch functions do (0 is EXPECTED and correct — see the note in webgpu-pairing.md).

## WebGPU-accelerated functions (6)

Standalone exports — this is where the GPU acceleration actually lives.

| Function                    | Markers                             | Module      |
| --------------------------- | ----------------------------------- | ----------- |
| `fuseUnaryChainAsync`       | `elementwiseChainGpuDispatch`       | typed/fused |
| `fuseUnaryChainReduceAsync` | `elementwiseChainReduceGpuDispatch` | typed/fused |
| `gpuAdd`                    | `gpuMatrixBackend`                  | typed/gpu   |
| `gpuMatmul`                 | `gpuMatrixBackend`                  | typed/gpu   |
| `gpuScale`                  | `gpuMatrixBackend`                  | typed/gpu   |
| `gpuTranspose`              | `gpuMatrixBackend`                  | typed/gpu   |

## Typed-dispatch layer: 0 of 218

> **A count of 0 here is EXPECTED and correct — it is a design decision, not a gap.**
>
> A GPU dispatch costs an upload and a readback. A _single_ typed op (`sin(xs)`) is therefore pure transfer tax and would be **slower** on the GPU than JS or WASM — the same economics that retired element-wise ops from the WASM backend. The GPU only pays off where the work amortizes that transfer: a **fused chain** of ops (`fuseUnaryChainAsync`, 3.2–8.3× over WASM, measured) or a large **matmul**. Those are standalone functions, listed above.
>
> Wiring every `mathTyped` function to a GPU path would make this number look better and make the library slower. So we don't.

| Routing (static) |   Count |
| ---------------- | ------: |
| WebGPU           |       0 |
| None             |     218 |
| **Total**        | **218** |

## Per-module counts (typed layer)

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
