/**
 * Shared acquire / write / dispatch / read / release path for matrix GPU kernels.
 */

import type { GPUBackend } from '../GPUBackend.js';

export type ShaderBindEntry = { binding: number; bufferIndex: number };

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
 * Run a compute shader described by `plan` on an initialized {@link GPUBackend}.
 */
export async function runShader(backend: GPUBackend, plan: RunShaderPlan): Promise<Float32Array> {
  const ctx = backend.getContext();
  const pool = backend.getBufferPool();
  const shaders = backend.getShaderManager();

  const storageBuffers = plan.bytes.map((byteSize, idx) =>
    pool.acquireStorageBuffer(
      byteSize,
      plan.storageLabels[idx] ?? `storage-${idx}`,
      true,
      idx !== plan.resultBufferIndex
    )
  );

  const bufferParams = pool.acquireUniformBuffer(UNIFORM_BYTES, 'params');
  for (let i = 0; i < plan.writes.length; i++) {
    ctx.writeBuffer(storageBuffers[i], plan.writes[i]);
  }
  ctx.writeBuffer(bufferParams, plan.params);

  const pipeline = shaders.getRegisteredPipeline(plan.pipeline);

  const bindResources = plan.bindEntries.map((entry) => {
    const buffer = entry.bufferIndex === -1 ? bufferParams : storageBuffers[entry.bufferIndex];
    return { binding: entry.binding, resource: { buffer } };
  });

  const bindGroup = ctx.createBindGroup(pipeline.getBindGroupLayout(0), bindResources);
  ctx.dispatchCompute(pipeline, [bindGroup], plan.workgroups);

  const resultData = await ctx.readBuffer(storageBuffers[plan.resultBufferIndex]);

  for (const buf of storageBuffers) {
    pool.release(buf);
  }
  pool.release(bufferParams);

  return new Float32Array(resultData);
}
