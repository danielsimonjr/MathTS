# Unused Files and Exports Analysis

**Generated**: 2026-02-06

## Summary

- **Potentially unused files**: 3
- **Potentially unused exports**: 48

## Potentially Unused Files

These files are not imported by any other file in the codebase:

- `src/backends/MatrixWasmBridge.ts`
- `src/matrix.ts`
- `src/types/parallel.d.ts`

## Potentially Unused Exports

These exports are not imported by any other file in the codebase:

### `src/backends/BackendManager.ts`

- `ExtendedBackendHints` (interface)

### `src/backends/gpu/BatchExecutor.ts`

- `BatchOperation` (interface)
- `BatchResult` (interface)
- `BatchOptions` (interface)
- `BatchOperationType` (type)

### `src/backends/gpu/BufferPool.ts`

- `BufferPoolOptions` (interface)

### `src/backends/gpu/detect.ts`

- `GPUAdapterInfo` (interface)

### `src/backends/gpu/GPUContext.ts`

- `GPUContextOptions` (interface)
- `DeviceLostEvent` (interface)
- `GPUContextStatus` (type)

### `src/backends/gpu/ShaderManager.ts`

- `ShaderSource` (interface)
- `PipelineConfig` (interface)

### `src/backends/gpu/Sync.ts`

- `TransferRequest` (interface)
- `TransferResult` (interface)
- `SyncConfig` (interface)
- `SyncStrategy` (type)
- `TransferDirection` (type)

### `src/backends/GPUBackend.ts`

- `GPUBackendStatus` (type)

### `src/backends/GPUMatrixBackend.ts`

- `GPUMatrixBackendConfig` (interface)

### `src/backends/ParallelBackend.ts`

- `ParallelBackendConfig` (interface)

### `src/backends/WASMBackend.ts`

- `WASMBackendConfig` (interface)

### `src/backends/WasmLoader.ts`

- `initWasm` (function)
- `WasmLoader` (class)

### `src/config.ts`

- `setConfig` (function)
- `resetConfig` (function)
- `setBackendPreference` (function)
- `setBackendThreshold` (function)
- `setBackendEnabled` (function)
- `getRecommendedBackend` (function)
- `forceBackend` (function)
- `enableProfiling` (function)
- `disableProfiling` (function)
- `enableAdaptiveTuning` (function)
- `disableAdaptiveTuning` (function)
- `configureAdaptiveTuning` (function)
- `BackendConfig` (interface)
- `AdaptiveTuningConfig` (interface)
- `ProfilingConfig` (interface)
- `BackendPreference` (type)
- `DEFAULT_CONFIG` (constant)

### `src/operations/eig.ts`

- `EigResult` (interface)
- `EigOptions` (interface)

### `src/operations/svd.ts`

- `SVDResult` (interface)
- `SVDOptions` (interface)

### `src/types/Matrix.ts`

- `MatrixDimensions` (interface)
- `MatrixIndex` (interface)
- `MatrixType` (type)

### `src/types.ts`

- `StorageFormat` (type)

