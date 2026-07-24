# @danielsimonjr/mathts-gpu API Reference

Shared WebGPU foundation for MathTS: device/adapter lifecycle, buffer pooling,
generic shader compile/cache, and capability detection.

> This package ships **no domain kernels**. It provides the reusable WebGPU
> plumbing (`GPUContext`, `BufferPool`, `ShaderManager`, capability `detect`).
> Consumers such as `@danielsimonjr/mathts-matrix` register their own WGSL onto
> the shared `ShaderManager` — `matrix` also re-exports this whole foundation
> for back-compat.

## Installation

```bash
npm install @danielsimonjr/mathts-gpu
```

## Overview

The GPU path is **f32-only** (WGSL has no `f64`) and off by default — a
deliberate precision change the caller must opt into via `enableGpu()`. Per
project convention this foundation is experimental scaffolding; the
AssemblyScript/WASM backend is the production-matured accelerator tier.

```typescript
import {
  GPUContext,
  BufferPool,
  ShaderManager,
  hasWebGPU,
  detectGPUCapabilities,
  enableGpu,
  getGpuDevice,
} from '@danielsimonjr/mathts-gpu';
```

## Classes

### GPUContext

Manages the WebGPU device/queue lifecycle.

```typescript
import { GPUContext } from '@danielsimonjr/mathts-gpu';
```

#### Constructor

```typescript
new GPUContext(options?: GPUContextOptions)
```

#### Properties (getters)

| Property       | Type                      | Description                                                         |
| -------------- | ------------------------- | ------------------------------------------------------------------- |
| `status`       | `GPUContextStatus`        | `'uninitialized' \| 'initializing' \| 'ready' \| 'error' \| 'lost'` |
| `isReady`      | `boolean`                 | Whether the device is ready                                         |
| `capabilities` | `GPUCapabilities \| null` | Detected adapter capabilities (once initialized)                    |
| `lastError`    | `Error \| null`           | Last error encountered                                              |

#### Methods

| Method                  | Signature                                                                   | Description                                                          |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `initialize`            | `(options?: GPUContextOptions) => Promise<boolean>`                         | Never throws; concurrent callers coalesce; unsupported env → `false` |
| `getDevice`             | `() => GPUDevice`                                                           | Throws if not initialized                                            |
| `getQueue`              | `() => GPUQueue`                                                            | The device queue                                                     |
| `onDeviceLost`          | `(callback: (event: DeviceLostEvent) => void) => void`                      | Register device-lost handler                                         |
| `createCommandEncoder`  | `(label?: string) => GPUCommandEncoder`                                     | Create a command encoder                                             |
| `createBuffer`          | `(size, usage, label?, mappedAtCreation?) => GPUBuffer`                     | Create a raw buffer                                                  |
| `createStorageBuffer`   | `(size, label?, readable?, writable?) => GPUBuffer`                         | Create a storage buffer                                              |
| `createStagingBuffer`   | `(size, label?) => GPUBuffer`                                               | Create a staging (readback) buffer                                   |
| `createComputePipeline` | `(shaderModule, entryPoint, layout?, label?) => GPUComputePipeline`         | Build a compute pipeline                                             |
| `createShaderModule`    | `(code: string, label?) => GPUShaderModule`                                 | Compile WGSL to a module                                             |
| `createBindGroup`       | `(layout, entries, label?) => GPUBindGroup`                                 | Create a bind group                                                  |
| `submitCommands`        | `(commandBuffers: GPUCommandBuffer[]) => void`                              | Submit command buffers                                               |
| `writeBuffer`           | `(buffer, data, bufferOffset?, dataOffset?, size?) => void`                 | Upload data to a buffer                                              |
| `readBuffer`            | `(buffer, offset?, size?) => Promise<ArrayBuffer>`                          | Read data back from a buffer                                         |
| `dispatchCompute`       | `(pipeline, bindGroups, workgroupCounts: [number, number, number]) => void` | Dispatch a compute pass                                              |
| `waitForCompletion`     | `() => Promise<void>`                                                       | Await queue completion                                               |
| `destroy`               | `() => void`                                                                | Release the device                                                   |

---

### BufferPool

GPU buffer allocation/reuse to reduce per-dispatch allocation overhead.

```typescript
import { BufferPool } from '@danielsimonjr/mathts-gpu';
```

#### Constructor

```typescript
new BufferPool(context: GPUContext, options?: BufferPoolOptions)
```

#### Methods

| Method                 | Signature                                                                             | Description                       |
| ---------------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| `acquire`              | `(size, usage, label?) => GPUBuffer`                                                  | Acquire a pooled buffer           |
| `release`              | `(buffer: GPUBuffer) => void`                                                         | Return a buffer to the pool       |
| `acquireStorageBuffer` | `(size, label?, readable?, writable?) => GPUBuffer`                                   | Acquire a storage buffer          |
| `acquireStagingBuffer` | `(size, label?) => GPUBuffer`                                                         | Acquire a staging buffer          |
| `acquireUniformBuffer` | `(size, label?) => GPUBuffer`                                                         | Acquire a uniform buffer          |
| `evictOldBuffers`      | `() => void`                                                                          | Evict buffers past their timeout  |
| `evictToSize`          | `(targetSize: number) => void`                                                        | Evict down to a target cache size |
| `startAutoEviction`    | `(interval: number) => void`                                                          | Begin periodic eviction           |
| `stopAutoEviction`     | `() => void`                                                                          | Stop periodic eviction            |
| `getStats`             | `() => { totalBuffers, inUseBuffers, cachedBuffers, currentCacheSize, maxCacheSize }` | Pool statistics                   |
| `clear`                | `() => void`                                                                          | Clear all cached buffers          |
| `destroy`              | `() => void`                                                                          | Destroy the pool                  |

---

### ShaderManager

Generic WGSL compile/cache plus a name → code registry. Ships **no** built-in
shaders — domain packages register their own.

```typescript
import { ShaderManager } from '@danielsimonjr/mathts-gpu';
```

#### Constructor

```typescript
new ShaderManager(context: GPUContext)
```

#### Methods

| Method                      | Signature                                                        | Description                                          |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| `getShaderModule`           | `(name, code) => GPUShaderModule`                                | Compile (or return cached) module                    |
| `getPipeline`               | `(shaderName, entryPoint, code?, layout?) => GPUComputePipeline` | Build (or return cached) pipeline                    |
| `registerShader`            | `(name: string, code: string) => void`                           | Register WGSL by name (bookkeeping only, no compile) |
| `hasRegisteredShader`       | `(name: string) => boolean`                                      | Whether a name is registered                         |
| `getRegisteredShaderSource` | `(name: string) => string`                                       | Get registered source (throws if unregistered)       |
| `getRegisteredShaderModule` | `(name: string) => GPUShaderModule`                              | Compile a registered shader                          |
| `getRegisteredPipeline`     | `(name, entryPoint?) => GPUComputePipeline`                      | Pipeline for a registered shader                     |
| `precompileRegistered`      | `() => void`                                                     | Compile every registered shader + default pipeline   |
| `clearCache`                | `() => void`                                                     | Clear compiled cache (registrations retained)        |
| `getStats`                  | `() => { cachedShaders, cachedPipelines }`                       | Cache statistics                                     |

## Capability Detection

```typescript
import {
  hasWebGPU,
  isBrowser,
  getGPUAdapter,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getRecommendedWorkgroupSize,
  getMaxMatrixSize,
} from '@danielsimonjr/mathts-gpu';
```

| Function                      | Signature                                                             | Description                            |
| ----------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `hasWebGPU`                   | `() => boolean`                                                       | Is WebGPU present in this runtime      |
| `isBrowser`                   | `() => boolean`                                                       | Browser vs Node detection              |
| `getGPUAdapter`               | `(options?: GPURequestAdapterOptions) => Promise<GPUAdapter \| null>` | Request an adapter                     |
| `detectGPUCapabilities`       | `(preferHighPerformance?: boolean) => Promise<GPUCapabilities>`       | Probe adapter limits/features          |
| `isGPUSuitableForMatrixOps`   | `(capabilities, minBufferSize?) => boolean`                           | Heuristic suitability check            |
| `getRecommendedWorkgroupSize` | `(capabilities) => [number, number, number]`                          | Suggested workgroup dims               |
| `getMaxMatrixSize`            | `(capabilities, bytesPerElement?) => number`                          | Largest matrix that fits buffer limits |

## Global Context & Device Singleton

```typescript
import {
  getGlobalGPUContext,
  initializeGlobalGPU,
  destroyGlobalGPU,
  getGpuDevice,
  resetGpuDevice,
} from '@danielsimonjr/mathts-gpu';
```

| Function              | Signature                                                     | Description                                                         |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `getGlobalGPUContext` | `() => GPUContext`                                            | Shared process-wide context                                         |
| `initializeGlobalGPU` | `(options?: GPUContextOptions) => Promise<boolean>`           | Initialize the global context                                       |
| `destroyGlobalGPU`    | `() => void`                                                  | Destroy the global context                                          |
| `getGpuDevice`        | `(options?: GPUContextOptions) => Promise<GPUDevice \| null>` | Shared device singleton — coalesces concurrent calls, never rejects |
| `resetGpuDevice`      | `() => void`                                                  | Clear the cached device (after device-lost or between tests)        |

## Opt-in GPU Routing

The GPU path is f32-only, so implicit routing is gated behind an explicit flag.

```typescript
import { enableGpu, disableGpu, isGpuEnabled } from '@danielsimonjr/mathts-gpu';

enableGpu(); // opt into implicit GPU routing
isGpuEnabled(); // true
disableGpu(); // back to CPU tiers
```

| Function       | Signature       | Description                            |
| -------------- | --------------- | -------------------------------------- |
| `enableGpu`    | `() => void`    | Enable implicit GPU routing            |
| `disableGpu`   | `() => void`    | Disable implicit GPU routing (default) |
| `isGpuEnabled` | `() => boolean` | Current flag state                     |

> Explicit entry points (e.g. `gpuMatmul`) are their own opt-in and do not
> require `enableGpu()`.

## Dispatch Serialization

```typescript
import { serializeGpu } from '@danielsimonjr/mathts-gpu';

const result = await serializeGpu(() => runMyDispatch());
```

`serializeGpu<T>(task: () => Promise<T>): Promise<T>` funnels every GPU dispatch
through one serialization queue. This prevents `pushErrorScope` /
`popErrorScope` LIFO-stack corruption between concurrent dispatches — a real
hazard where `Promise.all([opA(), opB()])` could attribute one call's error to
another, or return a zero-initialized "success" for a call that actually failed.

## Types

| Type                | Key fields                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GPUContextOptions` | `preferHighPerformance?`, `requiredFeatures?`, `requiredLimits?`, `label?`                                                                                                                               |
| `GPUContextStatus`  | `'uninitialized' \| 'initializing' \| 'ready' \| 'error' \| 'lost'`                                                                                                                                      |
| `GPUAdapterInfo`    | `vendor`, `architecture`, `device`, `description`                                                                                                                                                        |
| `GPUCapabilities`   | `supported`, `adapterInfo`, `maxBufferSize`, `maxWorkgroupSize`, `maxStorageBufferBindingSize`, `maxComputeInvocationsPerWorkgroup`, `maxComputeWorkgroupsPerDimension`, `isFallbackAdapter`, `features` |
| `DeviceLostEvent`   | `reason`, `message`                                                                                                                                                                                      |
| `BufferPoolOptions` | `maxCacheSize?`, `evictionTimeout?`, `autoEvict?`, `evictionInterval?`                                                                                                                                   |
| `ShaderSource`      | `code`, `entryPoint`, `label?`                                                                                                                                                                           |
| `PipelineConfig`    | `entryPoint`, `layout?`, `label?`                                                                                                                                                                        |

## Constants

| Constant           | Value   | Description                                                                             |
| ------------------ | ------- | --------------------------------------------------------------------------------------- |
| `GPU_MIN_ELEMENTS` | `65536` | Minimum element count before a dispatch's upload/readback cost is worthwhile (measured) |

## Example

```typescript
import { getGlobalGPUContext, initializeGlobalGPU, ShaderManager } from '@danielsimonjr/mathts-gpu';

const ok = await initializeGlobalGPU({ preferHighPerformance: true });
if (ok) {
  const ctx = getGlobalGPUContext();
  const shaders = new ShaderManager(ctx);

  // Domain packages register their own WGSL:
  shaders.registerShader('myKernel', `@compute @workgroup_size(64) fn main() {}`);
  const pipeline = shaders.getRegisteredPipeline('myKernel');
}
```
