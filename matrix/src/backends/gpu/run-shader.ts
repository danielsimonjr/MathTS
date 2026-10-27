/**
 * Shared acquire / write / dispatch / read / release path for matrix GPU kernels.
 */

import type { BufferPool, GPUContext, ShaderManager } from '@danielsimonjr/mathts-gpu';

export type ShaderBindEntry = { binding: number; bufferIndex: number };

/**
 * Structural host for {@link runShader}. Kept local so this module does not
 * import GPUBackend (that import was a type-only cycle).
 */
export interface RunShaderHost {
  getContext(): GPUContext;
  getBufferPool(): BufferPool;
  getShaderManager(): ShaderManager;
}

export interface RunShaderPlan {
  pipeline: string;
  bytes: number[];
  storageLabels: string[];
  writes: Float32Array[];
  bindEntries: ShaderBindEntry[];
  params: ArrayBufferView;
  workgroups: [number, number, number];
  resultBufferIndex: number;
}

const UNIFORM_BYTES = 16;

export function planRunShaderFromAdd(
  a: Float32Array,
  b: Float32Array,
  rows: number,
  cols: number,
  workgroups: [number, number, number]
): RunShaderPlan {
  const size = rows * cols * 4;
  return {
    pipeline: 'matrixAdd',
    bytes: [size, size, size],
    storageLabels: ['matrix-a', 'matrix-b', 'matrix-result'],
    writes: [a, b],
    bindEntries: [
      { binding: 0, bufferIndex: 0 },
      { binding: 1, bufferIndex: 1 },
      { binding: 2, bufferIndex: 2 },
      { binding: 3, bufferIndex: -1 },
    ],
    params: new Uint32Array([rows, cols, 0, 0]),
    workgroups,
    resultBufferIndex: 2,
  };
}

export function planRunShaderFromMatmul(
  a: Float32Array,
  b: Float32Array,
  M: number,
  K: number,
  N: number,
  workgroups: [number, number, number]
): RunShaderPlan {
  return {
    pipeline: 'matmul',
    bytes: [M * K * 4, K * N * 4, M * N * 4],
    storageLabels: ['matmul-a', 'matmul-b', 'matmul-result'],
    writes: [a, b],
    bindEntries: [
      { binding: 0, bufferIndex: 0 },
      { binding: 1, bufferIndex: 1 },
      { binding: 2, bufferIndex: 2 },
      { binding: 3, bufferIndex: -1 },
    ],
    params: new Uint32Array([M, N, K, 0]),
    workgroups,
    resultBufferIndex: 2,
  };
}

export function planRunShaderFromTranspose(
  a: Float32Array,
  rows: number,
  cols: number,
  workgroups: [number, number, number]
): RunShaderPlan {
  const size = rows * cols * 4;
  return {
    pipeline: 'transpose',
    bytes: [size, size],
    storageLabels: ['transpose-a', 'transpose-result'],
    writes: [a],
    bindEntries: [
      { binding: 0, bufferIndex: 0 },
      { binding: 1, bufferIndex: 1 },
      { binding: 2, bufferIndex: -1 },
    ],
    params: new Uint32Array([rows, cols, 0, 0]),
    workgroups,
    resultBufferIndex: 1,
  };
}

/**
 * Run a compute shader described by `plan` on an initialized GPU backend host.
 * Buffers are released on both success and throw (the pre-extract bodies only
 * released after a successful readback).
 */
export async function runShader(
  backend: RunShaderHost,
  plan: RunShaderPlan
): Promise<Float32Array> {
  const ctx = backend.getContext();
  const pool = backend.getBufferPool();
  const shaders = backend.getShaderManager();

  const storageBuffers: GPUBuffer[] = [];
  let bufferParams: GPUBuffer | undefined;
  try {
    for (let idx = 0; idx < plan.bytes.length; idx++) {
      const byteSize = plan.bytes[idx];
      if (byteSize === undefined) {
        throw new Error(`runShader: missing byte size at index ${idx}`);
      }
      storageBuffers.push(
        pool.acquireStorageBuffer(
          byteSize,
          plan.storageLabels[idx] ?? `storage-${idx}`,
          true,
          idx !== plan.resultBufferIndex
        )
      );
    }

    bufferParams = pool.acquireUniformBuffer(UNIFORM_BYTES, 'params');
    for (let i = 0; i < plan.writes.length; i++) {
      const target = storageBuffers[i];
      const payload = plan.writes[i];
      if (target === undefined || payload === undefined) {
        throw new Error(`runShader: missing write target at index ${i}`);
      }
      ctx.writeBuffer(target, payload);
    }
    ctx.writeBuffer(bufferParams, plan.params);

    const pipeline = shaders.getRegisteredPipeline(plan.pipeline);

    const bindResources = plan.bindEntries.map((entry) => {
      const buffer = entry.bufferIndex === -1 ? bufferParams : storageBuffers[entry.bufferIndex];
      if (buffer === undefined) {
        throw new Error(`runShader: missing buffer for binding ${entry.binding}`);
      }
      return { binding: entry.binding, resource: { buffer } };
    });

    const bindGroup = ctx.createBindGroup(pipeline.getBindGroupLayout(0), bindResources);
    ctx.dispatchCompute(pipeline, [bindGroup], plan.workgroups);

    const resultBuf = storageBuffers[plan.resultBufferIndex];
    if (resultBuf === undefined) {
      throw new Error(`runShader: missing result buffer at index ${plan.resultBufferIndex}`);
    }
    const resultData = await ctx.readBuffer(resultBuf);
    return new Float32Array(resultData);
  } finally {
    for (const buf of storageBuffers) {
      pool.release(buf);
    }
    if (bufferParams !== undefined) {
      pool.release(bufferParams);
    }
  }
}
