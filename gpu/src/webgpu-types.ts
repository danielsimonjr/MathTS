/**
 * WebGPU handle types for the published declarations.
 *
 * The WebGPU types (`@webgpu/types`) declare globals such as `GPUBuffer`, and the package that
 * declares them needs the DOM lib. A declaration file that names those globals fails in a
 * consumer that has neither (`skipLibCheck: false`, no DOM lib, no `@webgpu/types`).
 * Each type here resolves to the real global type when the compiling project has it, and to an
 * opaque handle type when it has not. The repository compiles with `@webgpu/types`, so source
 * code sees the real types; a consumer without them sees opaque handles that it can only pass
 * back to this package.
 *
 * @packageDocumentation
 */

/** Stand-in for a WebGPU object when the consumer has no WebGPU types. */
export interface OpaqueGpuHandle<Name extends string> {
  readonly __webgpuHandle?: Name;
}

/** The instance type of the global class `Key`, or `Fallback` when no such global exists. */
type GlobalInstance<Key extends string, Fallback> = typeof globalThis extends {
  [K in Key]: { prototype: infer Instance };
}
  ? Instance
  : Fallback;

export type GPUBuffer = GlobalInstance<'GPUBuffer', OpaqueGpuHandle<'GPUBuffer'>>;
export type GPUAdapter = GlobalInstance<'GPUAdapter', OpaqueGpuHandle<'GPUAdapter'>>;
export type GPUDevice = GlobalInstance<'GPUDevice', OpaqueGpuHandle<'GPUDevice'>>;
export type GPUQueue = GlobalInstance<'GPUQueue', OpaqueGpuHandle<'GPUQueue'>>;
export type GPUCommandEncoder = GlobalInstance<
  'GPUCommandEncoder',
  OpaqueGpuHandle<'GPUCommandEncoder'>
>;
export type GPUCommandBuffer = GlobalInstance<
  'GPUCommandBuffer',
  OpaqueGpuHandle<'GPUCommandBuffer'>
>;
export type GPUShaderModule = GlobalInstance<'GPUShaderModule', OpaqueGpuHandle<'GPUShaderModule'>>;
export type GPUPipelineLayout = GlobalInstance<
  'GPUPipelineLayout',
  OpaqueGpuHandle<'GPUPipelineLayout'>
>;
export type GPUComputePipeline = GlobalInstance<
  'GPUComputePipeline',
  OpaqueGpuHandle<'GPUComputePipeline'>
>;
export type GPUBindGroupLayout = GlobalInstance<
  'GPUBindGroupLayout',
  OpaqueGpuHandle<'GPUBindGroupLayout'>
>;
export type GPUBindGroup = GlobalInstance<'GPUBindGroup', OpaqueGpuHandle<'GPUBindGroup'>>;

/** A bit mask of `GPUBufferUsage` flags. */
export type GPUBufferUsageFlags = number;

/** A device feature name such as `'shader-f16'`. */
export type GPUFeatureName = string;

/** Why a device was lost. */
export type GPUDeviceLostReason = 'unknown' | 'destroyed';

/** Options of `navigator.gpu.requestAdapter`. */
export interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance';
  forceFallbackAdapter?: boolean;
}

/** One entry of a bind group: a buffer bound to a shader slot. */
export interface GPUBindGroupEntry {
  binding: number;
  resource: { buffer: GPUBuffer; offset?: number; size?: number };
}
