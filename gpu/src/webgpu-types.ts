/**
 * WebGPU handle types of the published declarations.
 *
 * The WebGPU types are globals (`GPUDevice`, `GPUBuffer`, ...) that come from the WebGPU typings
 * package or, in TypeScript 7 and later, from the DOM lib. A declaration file that names those
 * globals fails in a consumer that has neither (`skipLibCheck: false`, no DOM lib, no typings).
 *
 * Each handle type here is therefore an alias with two meanings:
 *
 * - When the compiling project declares the global class, the alias IS that global type. A
 *   consumer with WebGPU types sees exactly the types it always saw, with every member.
 * - When the project has no such global, the alias is the `*Shape` interface below: the part of
 *   WebGPU that this package uses, declared as an interface of its own. A consumer without
 *   WebGPU types can still call those members and pass the handles back to this package.
 *
 * Each `*Shape` is a subset of its global type: `gpu/tests/webgpu-shapes.test.ts` assigns a real
 * handle to every shape, so the two meanings cannot drift apart. The packed-consumer test
 * (`tools/test/packed-consumer.test.mjs`) compiles a consumer of each kind.
 *
 * @packageDocumentation
 */

/** The instance type of the global class `Key`, or `Shape` when the project declares no such global. */
type GlobalInstance<Key extends string, Shape> = typeof globalThis extends {
  [K in Key]: { prototype: infer Instance };
}
  ? Instance
  : Shape;

/** Limits of an adapter or device: the ones a compute kernel reads. */
export interface GPUSupportedLimits {
  readonly maxBufferSize: number;
  readonly maxStorageBufferBindingSize: number;
  readonly maxUniformBufferBindingSize: number;
  readonly maxStorageBuffersPerShaderStage: number;
  readonly maxComputeWorkgroupSizeX: number;
  readonly maxComputeWorkgroupSizeY: number;
  readonly maxComputeWorkgroupSizeZ: number;
  readonly maxComputeInvocationsPerWorkgroup: number;
  readonly maxComputeWorkgroupsPerDimension: number;
}

/** The set of optional features that an adapter or device supports. */
export interface GPUSupportedFeatures extends Iterable<string> {
  readonly size: number;
  has(feature: string): boolean;
}

/** A device feature name such as `'shader-f16'`. */
export type GPUFeatureName = string;

/** A bit mask of `GPUBufferUsage` flags. */
export type GPUBufferUsageFlags = number;

/** Why a device was lost. */
export type GPUDeviceLostReason = 'unknown' | 'destroyed';

/** Options of `navigator.gpu.requestAdapter`. */
export interface GPURequestAdapterOptions {
  powerPreference?: 'low-power' | 'high-performance';
  forceFallbackAdapter?: boolean;
}

/** WebGPU adapter information */
export interface GPUAdapterInfo {
  /** Adapter vendor */
  vendor: string;
  /** Adapter architecture */
  architecture: string;
  /** Device description */
  device: string;
  /** Driver description */
  description: string;
}

/** Options of `adapter.requestDevice`. */
export interface GPUDeviceDescriptor {
  label?: string;
  requiredFeatures?: Iterable<GPUFeatureName>;
  requiredLimits?: Record<string, number | undefined>;
}

/** The reason and message of a lost device. */
export interface GPUDeviceLostInfo {
  readonly reason: GPUDeviceLostReason;
  readonly message: string;
}

/** An error that a device reports through an error scope or the `uncapturederror` event. */
export interface GPUError {
  readonly message: string;
}

/** The event that `device.onuncapturederror` receives. */
export interface GPUUncapturedErrorEvent {
  readonly error: GPUError;
}

/**
 * Handler of `device.onuncapturederror`. A method-style signature makes the parameter bivariant,
 * so the handler slot of a real `GPUDevice` (which receives a DOM event) is assignable to it.
 */
export type GPUUncapturedErrorHandler = {
  handle(event: GPUUncapturedErrorEvent): unknown;
}['handle'];

/** Kinds of error scope. */
export type GPUErrorFilter = 'validation' | 'out-of-memory' | 'internal';

/** An object that carries a debugging label: the shape of every handle without methods. */
export interface GPUObjectBase {
  label: string;
}

/** The members of a WebGPU buffer that this package uses. */
export interface GPUBufferShape extends GPUObjectBase {
  readonly size: number;
  readonly usage: number;
  mapAsync(mode: number, offset?: number, size?: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
  destroy(): void;
}

/** One message of a shader compilation: an error, a warning or a note. */
export interface GPUCompilationMessage {
  readonly message: string;
  readonly type: 'error' | 'warning' | 'info';
  readonly lineNum: number;
  readonly linePos: number;
  readonly offset: number;
  readonly length: number;
}

/** The messages of one shader compilation. */
export interface GPUCompilationInfo {
  readonly messages: readonly GPUCompilationMessage[];
}

/** A compiled shader module. */
export interface GPUShaderModuleShape extends GPUObjectBase {
  getCompilationInfo(): Promise<GPUCompilationInfo>;
}

/** The layout of a pipeline's bind groups. */
export type GPUPipelineLayoutShape = GPUObjectBase;

/** The layout of one bind group. */
export type GPUBindGroupLayoutShape = GPUObjectBase;

/** A set of resources bound to a pipeline. */
export type GPUBindGroupShape = GPUObjectBase;

/** A recorded list of GPU commands. */
export type GPUCommandBufferShape = GPUObjectBase;

/** A compute pipeline. */
export interface GPUComputePipelineShape extends GPUObjectBase {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

/** One entry of a bind group: a buffer bound to a shader slot. */
export interface GPUBindGroupEntry {
  binding: number;
  resource: { buffer: GPUBuffer; offset?: number; size?: number };
}

/** Options of `device.createBuffer`. */
export interface GPUBufferDescriptor {
  label?: string;
  size: number;
  usage: GPUBufferUsageFlags;
  mappedAtCreation?: boolean;
}

/** Options of `device.createShaderModule`. */
export interface GPUShaderModuleDescriptor {
  label?: string;
  code: string;
}

/** One slot of a bind group layout: a buffer visible to some shader stages. */
export interface GPUBindGroupLayoutEntry {
  binding: number;
  /** A bit mask of `GPUShaderStage` flags. */
  visibility: number;
  buffer?: {
    type?: 'uniform' | 'storage' | 'read-only-storage';
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
  };
}

/** Options of `device.createBindGroupLayout`. */
export interface GPUBindGroupLayoutDescriptor {
  label?: string;
  entries: Iterable<GPUBindGroupLayoutEntry>;
}

/** Options of `device.createPipelineLayout`. */
export interface GPUPipelineLayoutDescriptor {
  label?: string;
  bindGroupLayouts: Iterable<GPUBindGroupLayout | null>;
}

/** Options of `device.createBindGroup`. */
export interface GPUBindGroupDescriptor {
  label?: string;
  layout: GPUBindGroupLayout;
  entries: GPUBindGroupEntry[];
}

/** Options of `device.createComputePipeline`. */
export interface GPUComputePipelineDescriptor {
  label?: string;
  layout: GPUPipelineLayout | 'auto';
  compute: { module: GPUShaderModule; entryPoint?: string };
}

/** The part of a command encoder that records one compute pass. */
export interface GPUComputePassEncoderShape extends GPUObjectBase {
  setPipeline(pipeline: GPUComputePipeline): void;
  setBindGroup(
    index: number,
    bindGroup: GPUBindGroup | null,
    dynamicOffsets?: Iterable<number>
  ): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  end(): void;
}

/** Records GPU commands. */
export interface GPUCommandEncoderShape extends GPUObjectBase {
  beginComputePass(descriptor?: { label?: string }): GPUComputePassEncoder;
  copyBufferToBuffer(
    source: GPUBuffer,
    sourceOffset: number,
    destination: GPUBuffer,
    destinationOffset: number,
    size: number
  ): void;
  finish(descriptor?: { label?: string }): GPUCommandBuffer;
}

/** The queue of a device: it runs command buffers and writes buffers. */
export interface GPUQueueShape extends GPUObjectBase {
  submit(commandBuffers: Iterable<GPUCommandBuffer>): void;
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: ArrayBuffer | ArrayBufferView,
    dataOffset?: number,
    size?: number
  ): void;
  onSubmittedWorkDone(): Promise<void>;
}

/** A logical GPU device. */
export interface GPUDeviceShape extends GPUObjectBase {
  readonly queue: GPUQueue;
  readonly features: GPUSupportedFeatures;
  readonly limits: GPUSupportedLimits;
  readonly lost: Promise<GPUDeviceLostInfo>;
  onuncapturederror: GPUUncapturedErrorHandler | null;
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
  createCommandEncoder(descriptor?: { label?: string }): GPUCommandEncoder;
  pushErrorScope(filter: GPUErrorFilter): void;
  popErrorScope(): Promise<GPUError | null>;
  destroy(): void;
}

/** A physical GPU. */
export interface GPUAdapterShape {
  readonly features: GPUSupportedFeatures;
  readonly limits: GPUSupportedLimits;
  readonly info?: GPUAdapterInfo;
  requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
}

export type GPUBuffer = GlobalInstance<'GPUBuffer', GPUBufferShape>;
export type GPUShaderModule = GlobalInstance<'GPUShaderModule', GPUShaderModuleShape>;
export type GPUPipelineLayout = GlobalInstance<'GPUPipelineLayout', GPUPipelineLayoutShape>;
export type GPUBindGroupLayout = GlobalInstance<'GPUBindGroupLayout', GPUBindGroupLayoutShape>;
export type GPUBindGroup = GlobalInstance<'GPUBindGroup', GPUBindGroupShape>;
export type GPUCommandBuffer = GlobalInstance<'GPUCommandBuffer', GPUCommandBufferShape>;
export type GPUComputePipeline = GlobalInstance<'GPUComputePipeline', GPUComputePipelineShape>;
export type GPUComputePassEncoder = GlobalInstance<
  'GPUComputePassEncoder',
  GPUComputePassEncoderShape
>;
export type GPUCommandEncoder = GlobalInstance<'GPUCommandEncoder', GPUCommandEncoderShape>;
export type GPUQueue = GlobalInstance<'GPUQueue', GPUQueueShape>;
export type GPUDevice = GlobalInstance<'GPUDevice', GPUDeviceShape>;
export type GPUAdapter = GlobalInstance<'GPUAdapter', GPUAdapterShape>;
