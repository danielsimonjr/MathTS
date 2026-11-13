/**
 * Each `*Shape` interface of the published declarations is a subset of its WebGPU global type.
 *
 * A handle type of this package is the global type when the compiling project has it, and the
 * `*Shape` interface when it has not (see `src/webgpu-types.ts`). Code that a consumer without
 * WebGPU types writes against a shape must also compile for a consumer with them. The
 * assignments below prove it: this file is compiled with `@webgpu/types` (see `tsconfig.json`),
 * so `GPUDevice` and the other bare names here are the real global types. A shape that names a
 * member the real type lacks, or types it differently, fails `bun run typecheck`.
 */
import { describe, expect, it } from 'vitest';
import type {
  GPUAdapterInfo,
  GPUAdapterShape,
  GPUBufferShape,
  GPUCommandEncoderShape,
  GPUComputePassEncoderShape,
  GPUComputePipelineShape,
  GPUDeviceShape,
  GPUQueueShape,
  GPUShaderModuleShape,
  GPUSupportedFeatures,
  GPUSupportedLimits,
} from '../src/webgpu-types.js';

declare const adapter: GPUAdapter;
declare const device: GPUDevice;
declare const buffer: GPUBuffer;
declare const queue: GPUQueue;
declare const encoder: GPUCommandEncoder;
declare const pass: GPUComputePassEncoder;
declare const pipeline: GPUComputePipeline;
declare const shaderModule: GPUShaderModule;

/** Never called: the body exists to be type-checked. */
function realHandlesAreShapes(): void {
  const shapes: unknown[] = [
    adapter satisfies GPUAdapterShape,
    device satisfies GPUDeviceShape,
    buffer satisfies GPUBufferShape,
    queue satisfies GPUQueueShape,
    encoder satisfies GPUCommandEncoderShape,
    pass satisfies GPUComputePassEncoderShape,
    pipeline satisfies GPUComputePipelineShape,
    shaderModule satisfies GPUShaderModuleShape,
    device.limits satisfies GPUSupportedLimits,
    device.features satisfies GPUSupportedFeatures,
    adapter.info satisfies GPUAdapterInfo,
  ];
  void shapes;
}

describe('WebGPU shapes', () => {
  it('every real handle type is assignable to its shape (compile-time check)', () => {
    expect(typeof realHandlesAreShapes).toBe('function');
  });
});
