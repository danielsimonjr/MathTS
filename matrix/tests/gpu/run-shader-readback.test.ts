/**
 * runShader reads back the bytes of the operation, not the bytes of the pooled buffer.
 *
 * The buffer pool rounds each storage buffer up to a power of two. A read of the
 * whole buffer returns extra elements when the matrix size is not a power of two
 * (32x48 f32 = 6144 bytes, pooled as 8192). The fake host below rounds the same way.
 */

import { describe, it, expect } from 'vitest';
import { runShader, planRunShaderFromTranspose } from '../../src/backends/gpu/run-shader.js';
import { SyncManager } from '../../src/backends/gpu/Sync.js';

function roundUpToPowerOf2(n: number): number {
  return 2 ** Math.ceil(Math.log2(n));
}

function fakeHost() {
  const reads: Array<{ bufferSize: number; size: number | undefined }> = [];
  const host = {
    getContext: () => ({
      writeBuffer: () => {},
      createBindGroup: () => ({}),
      dispatchCompute: () => {},
      readBuffer: (buffer: { size: number }, offset = 0, size?: number) => {
        reads.push({ bufferSize: buffer.size, size });
        return Promise.resolve(new ArrayBuffer(size ?? buffer.size - offset));
      },
    }),
    getBufferPool: () => ({
      acquireStorageBuffer: (size: number) => ({ size: roundUpToPowerOf2(size) }),
      acquireUniformBuffer: (size: number) => ({ size }),
      release: () => {},
    }),
    getShaderManager: () => ({
      getRegisteredPipeline: () => ({ getBindGroupLayout: () => ({}) }),
    }),
  };
  return { host, reads };
}

describe('runShader readback size', () => {
  it('returns rows*cols elements for a non-power-of-two transpose', async () => {
    const rows = 32;
    const cols = 48;
    const { host, reads } = fakeHost();
    const plan = planRunShaderFromTranspose(new Float32Array(rows * cols), rows, cols, [3, 2, 1]);

    const result = await runShader(host as never, plan);

    expect(reads[0]?.bufferSize).toBe(8192);
    expect(result.length).toBe(rows * cols);
  });
});

describe('SyncManager.batchTransfer readback size', () => {
  it('downloads only the bytes of the destination array from a larger pooled buffer', async () => {
    const context = {
      readBuffer: (buffer: { size: number }, offset = 0, size?: number) =>
        Promise.resolve(new ArrayBuffer(size ?? buffer.size - offset)),
    };
    const sync = new SyncManager(context as never, {} as never);
    const data = new Float32Array(1536);

    const results = await sync.batchTransfer([
      { data, buffer: { size: 8192 } as never, direction: 'gpu-to-cpu' },
    ]);

    expect(results[0]?.success).toBe(true);
    expect(results[0]?.bytesTransferred).toBe(1536 * 4);
  });
});
