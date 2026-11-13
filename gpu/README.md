# @danielsimonjr/mathts-gpu

## Install

```sh
npm install @danielsimonjr/mathts-gpu
```

## Example (Node without a GPU adapter)

```ts node
import { getGpuDevice, GPUContext } from '@danielsimonjr/mathts-gpu';

const device = await getGpuDevice();
console.log(device); // null in Node

const ctx = new GPUContext();
const ok = await ctx.initialize();
console.log(ok, ctx.status); // false, 'unavailable' when no adapter is present
```

## Overview

The shared WebGPU foundation for MathTS: `GPUContext` (device/adapter
lifecycle), a shared `getGpuDevice()` singleton, `BufferPool`, `detect`
(capability probing), and a **generic** `ShaderManager` (compile/cache/pipeline
infra + a name→code shader registration API). This package ships **no domain
kernels** — matrix-specific WGSL (matmul/transpose/reduce) lives in
`@danielsimonjr/mathts-matrix`, which registers those shaders onto a
`ShaderManager` at backend init.

WebGPU is browser-only (`navigator.gpu`); in Node every entry point degrades
gracefully — `getGpuDevice()` resolves to `null` and `GPUContext.initialize()`
resolves `false` without throwing. When no adapter is available (Node, or
Chromium without a GPU), `GPUContext.status` is `'unavailable'` (not `'error'`),
`lastError` stays `null`, and `hasWebGPU()` becomes `false` after the first
failed probe so feature detection matches `initializeGlobalGPU()`. Use
`initializeGlobalGPUWithReason()` when you need `{ ok, reason }`. A rejected
`requestAdapter` or `requestDevice` stays `status: 'error'` with `lastError`
set — that is not a quiet fallback. `enableGpuUnavailableWarnings()` logs the
unavailable case once; it is off by default. `isGPUSuitableForMatrixOps()` is
synchronous and returns false when capabilities are omitted.

Tracked by CDG/DGT (`create-dependency-graph`) as a leaf: `matrix → gpu` and
`functions → gpu` (functions re-exports `enableGpu` / `GPU_MIN_ELEMENTS` and hosts
domain WGSL in `functions/src/gpu/`), with no back-edge from `gpu` to those packages.
