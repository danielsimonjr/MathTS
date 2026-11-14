/**
 * GPUBackend.scale reads back the bytes of the result, not the bytes of the pooled buffer.
 *
 * The buffer pool rounds each buffer up to a power of two (1536 f32 = 6144 bytes,
 * pooled as 8192). The fakes below round the same way.
 */

import { describe, it, expect } from 'vitest';
import { GPUBackend } from '../../src/backends/GPUBackend.js';

describe('GPUBackend.scale readback size', () => {
  it('returns one element per input element for a non-power-of-two size', async () => {
    const backend = new GPUBackend();
    Object.assign(backend as unknown as Record<string, unknown>, {
      _status: 'ready',
      context: {
        writeBuffer: () => {},
        createBindGroup: () => ({}),
        dispatchCompute: () => {},
        readBuffer: (buffer: { size: number }, offset = 0, size?: number) =>
          Promise.resolve(new ArrayBuffer(size ?? buffer.size - offset)),
      },
      bufferPool: {
        acquireStorageBuffer: (n: number) => ({ size: 2 ** Math.ceil(Math.log2(n)) }),
        acquireUniformBuffer: (n: number) => ({ size: n }),
        release: () => {},
      },
      shaderManager: { getRegisteredPipeline: () => ({ getBindGroupLayout: () => ({}) }) },
    });

    const result = await backend.scale(new Float32Array(1536), 2);

    expect(result.length).toBe(1536);
  });
});
