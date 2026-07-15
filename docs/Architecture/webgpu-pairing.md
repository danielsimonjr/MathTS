# WebGPU Accelerator ↔ Function Pairing

**Generated**: 2026-07-15 (by tools/create-dependency-graph)

The GPU analog of `wasm-pairing.md`. Which functions route to a **WebGPU** path — detected via a `*GpuDispatch` bridge (mirroring the `*Dispatch` WASM convention) or a direct GPU backend/device reference (`GPUBackend` / `gpuMatrixBackend` / `getGpuDevice`).

> **Status:** 9 standalone function(s) route to WebGPU; 2 of 219 typed-dispatch functions do — see the note in webgpu-pairing.md for why that number is deliberately small.

## WebGPU-accelerated functions (9)

Standalone exports — this is where the GPU acceleration actually lives.

| Function                            | Markers                             | Module              |
| ----------------------------------- | ----------------------------------- | ------------------- |
| `elementwiseChainGpuDispatch`       | `getGpuDevice`                      | gpu/elementwise-gpu |
| `elementwiseChainReduceGpuDispatch` | `getGpuDevice`                      | gpu/elementwise-gpu |
| `fftGpuDispatch`                    | `fftGpuDispatch`, `getGpuDevice`    | gpu/fft-gpu         |
| `fuseUnaryChainAsync`               | `elementwiseChainGpuDispatch`       | typed/fused         |
| `fuseUnaryChainReduceAsync`         | `elementwiseChainReduceGpuDispatch` | typed/fused         |
| `gpuAdd`                            | `gpuMatrixBackend`                  | typed/gpu           |
| `gpuMatmul`                         | `gpuMatrixBackend`                  | typed/gpu           |
| `gpuScale`                          | `gpuMatrixBackend`                  | typed/gpu           |
| `gpuTranspose`                      | `gpuMatrixBackend`                  | typed/gpu           |

## Typed-dispatch layer: 2 of 219

> **A SMALL count here is EXPECTED and correct — it is a design decision, not a gap.**
>
> A GPU dispatch costs an upload and a readback. A _single_ typed op (`sin(xs)`) is therefore pure transfer tax and would be **slower** on the GPU than JS or WASM — the same economics that retired element-wise ops from the WASM backend. The GPU only pays off where the work amortizes that transfer: a **fused chain** of ops (`fuseUnaryChainAsync`, 3.2–8.3× over WASM, measured) a large **matmul**, or an **FFT** (parallelFFT/parallelIFFT above 262,144 points: log2(n) passes amortize the upload, ~2.2-3.4x measured). functions, listed above.
>
> Wiring every `mathTyped` function to a GPU path would make this number look better and make the library slower. So we don't.

| Routing (static) |   Count |
| ---------------- | ------: |
| WebGPU           |       2 |
| None             |     217 |
| **Total**        | **219** |

### Typed functions routing to WebGPU

| Function       | Markers          | Module |
| -------------- | ---------------- | ------ |
| `parallelFFT`  | `fftGpuDispatch` | signal |
| `parallelIFFT` | `fftGpuDispatch` | signal |

## Per-module counts (typed layer)

| Module        | WebGPU | None |
| ------------- | -----: | ---: |
| arithmetic    |      0 |   46 |
| bitwise       |      0 |    7 |
| combinatorics |      0 |   21 |
| complex       |      0 |    4 |
| distributions |      0 |   14 |
| logical       |      0 |    5 |
| matrix-ops    |      0 |    9 |
| probability   |      0 |    8 |
| relational    |      0 |    7 |
| set           |      0 |   10 |
| signal        |      2 |    5 |
| special       |      0 |   38 |
| statistics    |      0 |   17 |
| string        |      0 |    5 |
| trigonometry  |      0 |   19 |
| unit          |      0 |    2 |
