/**
 * P6-11 pin: the GPU chain lifecycle, on a stubbed device.
 *
 * `elementwiseChainGpuDispatch` and `elementwiseChainReduceGpuDispatch` share one
 * lifecycle: gates, device-limit checks, one validation error scope, pooled buffers,
 * one encoder, ping-pong passes, one submit, one pop, a readback, and a `finally`
 * that balances the scope and releases every buffer. The failure it guards is silent:
 * an unbalanced scope pops a CONCURRENT dispatch's scope and a validation error then
 * reads back as zeros; a release the `finally` skips leaks a pool buffer.
 *
 * Node has no `navigator.gpu`, so the shared foundation's device, `ShaderManager` and
 * `BufferPool` are replaced with recording fakes. Everything else is the real code:
 * `serializeGpu`, the gate flag and threshold, `isGpuChainSupported`, and the dispatchers.
 * The expectations were written against the pre-refactor pair of copies and must hold
 * unchanged for the shared lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface FakeBuffer {
  label: string;
  bytes: number;
  kind: 'storage' | 'staging' | 'uniform';
}

interface PassRecord {
  label: string;
  pipeline: string;
  bound: string[];
  workgroups: number;
}

interface EncoderRecord {
  label: string;
  passes: PassRecord[];
  copies: Array<{ from: string; to: string; size: number }>;
}

interface StubState {
  device: unknown;
  deviceCalls: number;
  events: string[];
  acquired: FakeBuffer[];
  released: FakeBuffer[];
  failAcquire: string | null;
  encoders: EncoderRecord[];
  writes: Array<{ label: string; data: ArrayBufferView }>;
  submits: number;
  maps: Array<{ label: string; offset: number; size: number }>;
  popResult: unknown;
  popRejects: boolean;
  submitThrows: boolean;
  encoderThrows: boolean;
  mapRejects: boolean;
  mapGate: Promise<void> | null;
  stagingFill: (bytes: number) => ArrayBuffer;
  limits: {
    maxComputeWorkgroupsPerDimension: number;
    maxStorageBufferBindingSize: number;
    maxBufferSize: number;
  };
}

const state = vi.hoisted<StubState>(() => ({
  device: null,
  deviceCalls: 0,
  events: [],
  acquired: [],
  released: [],
  failAcquire: null,
  encoders: [],
  writes: [],
  submits: 0,
  maps: [],
  popResult: null,
  popRejects: false,
  submitThrows: false,
  encoderThrows: false,
  mapRejects: false,
  mapGate: null,
  stagingFill: (bytes: number) => new ArrayBuffer(bytes),
  limits: {
    maxComputeWorkgroupsPerDimension: 65535,
    maxStorageBufferBindingSize: 1 << 30,
    maxBufferSize: 1 << 30,
  },
}));

vi.mock('@danielsimonjr/mathts-gpu', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@danielsimonjr/mathts-gpu')>();

  const acquire = (kind: FakeBuffer['kind']) => (bytes: number, label: string) => {
    if (state.failAcquire === label) throw new Error(`out of memory acquiring ${label}`);
    const buffer: FakeBuffer = { label, bytes, kind };
    if (kind === 'staging') {
      Object.assign(buffer, {
        async mapAsync(_mode: number, offset: number, size: number) {
          state.maps.push({ label, offset, size });
          if (state.mapGate) await state.mapGate;
          if (state.mapRejects) throw new Error('map failed');
        },
        getMappedRange: (_offset: number, size: number) => state.stagingFill(size),
        unmap() {},
      });
    }
    state.acquired.push(buffer);
    return buffer;
  };

  class FakePool {
    acquireStorageBuffer = acquire('storage');
    acquireStagingBuffer = acquire('staging');
    acquireUniformBuffer = acquire('uniform');
    release(buffer: FakeBuffer): void {
      state.released.push(buffer);
    }
    destroy(): void {}
  }

  class FakeShaderManager {
    registerShader(): void {}
    precompileRegistered(): void {}
    getRegisteredPipeline(key: string) {
      return { key, getBindGroupLayout: (i: number) => ({ key, i }) };
    }
  }

  return {
    ...actual,
    getGpuDevice: async () => {
      state.deviceCalls++;
      return state.device;
    },
    getGlobalGPUContext: () => ({}),
    ShaderManager: FakeShaderManager,
    BufferPool: FakePool,
  };
});

import {
  elementwiseChainGpuDispatch,
  elementwiseChainReduceGpuDispatch,
  resetGpuElementwise,
  type GpuReduceOp,
} from '../src/gpu/elementwise-gpu.js';
import { enableGpu, disableGpu, GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';

const N = GPU_MIN_ELEMENTS;
const BYTES = N * 4;
const WORKGROUPS = Math.ceil(N / 256);
const PARTIAL_BYTES = WORKGROUPS * 4;

const input = (): Float64Array =>
  Float64Array.from({ length: N }, (_, i) => (i % 100) / 100 + 0.01);

function makeDevice(): unknown {
  const pass = (record: EncoderRecord, label: string) => {
    const p: PassRecord = { label, pipeline: '', bound: [], workgroups: -1 };
    record.passes.push(p);
    return {
      setPipeline(pipeline: { key: string }) {
        p.pipeline = pipeline.key;
      },
      setBindGroup(_i: number, group: { entries: Array<{ resource: { buffer: FakeBuffer } }> }) {
        p.bound = group.entries.map((e) => e.resource.buffer.label);
      },
      dispatchWorkgroups(n: number) {
        p.workgroups = n;
      },
      end() {},
    };
  };

  return {
    limits: state.limits,
    pushErrorScope(filter: string) {
      state.events.push(`push:${filter}`);
    },
    async popErrorScope() {
      state.events.push('pop');
      if (state.popRejects) throw new Error('device lost');
      return state.popResult;
    },
    queue: {
      writeBuffer(buffer: FakeBuffer, _offset: number, data: ArrayBufferView) {
        state.writes.push({ label: buffer.label, data });
      },
      submit() {
        if (state.submitThrows) throw new Error('submit failed');
        state.submits++;
      },
    },
    createCommandEncoder({ label }: { label: string }) {
      if (state.encoderThrows) throw new Error('encoder failed');
      const record: EncoderRecord = { label, passes: [], copies: [] };
      state.encoders.push(record);
      return {
        beginComputePass: ({ label: l }: { label: string }) => pass(record, l),
        copyBufferToBuffer(from: FakeBuffer, _a: number, to: FakeBuffer, _b: number, size: number) {
          record.copies.push({ from: from.label, to: to.label, size });
        },
        finish: () => ({}),
      };
    },
    createBindGroup: (desc: unknown) => desc,
  };
}

function reset(): void {
  state.deviceCalls = 0;
  state.events = [];
  state.acquired = [];
  state.released = [];
  state.failAcquire = null;
  state.encoders = [];
  state.writes = [];
  state.submits = 0;
  state.maps = [];
  state.popResult = null;
  state.popRejects = false;
  state.submitThrows = false;
  state.encoderThrows = false;
  state.mapRejects = false;
  state.mapGate = null;
  state.stagingFill = (bytes: number) => new ArrayBuffer(bytes);
  state.limits = {
    maxComputeWorkgroupsPerDimension: 65535,
    maxStorageBufferBindingSize: 1 << 30,
    maxBufferSize: 1 << 30,
  };
  state.device = makeDevice();
}

const labels = (buffers: FakeBuffer[]): string[] => buffers.map((b) => b.label);

/** Every acquired buffer is released exactly once, and nothing else is released. */
function expectPoolBalanced(): void {
  expect(state.released).toHaveLength(state.acquired.length);
  for (const buffer of state.acquired) {
    expect(state.released.filter((r) => r === buffer)).toHaveLength(1);
  }
}

beforeEach(() => {
  reset();
  resetGpuElementwise();
  vi.stubGlobal('GPUMapMode', { READ: 1, WRITE: 2 });
  enableGpu();
});

afterEach(() => {
  disableGpu();
  resetGpuElementwise();
  vi.unstubAllGlobals();
});

const dispatchers: Array<{
  name: string;
  /** Acquire order, then the same order is the release order. */
  acquires: string[];
  run: (
    ops: readonly string[],
    xs?: Float64Array | Float32Array,
    opts?: { gpu?: boolean }
  ) => Promise<unknown>;
}> = [
  {
    name: 'elementwiseChainGpuDispatch',
    acquires: ['chain-a', 'chain-b', 'chain-staging', 'chain-params'],
    run: (ops, xs = input(), opts) => elementwiseChainGpuDispatch(ops, xs, opts),
  },
  {
    name: 'elementwiseChainReduceGpuDispatch',
    acquires: ['chain-a', 'chain-b', 'reduce-partials', 'reduce-staging', 'chain-params'],
    run: (ops, xs = input(), opts) => elementwiseChainReduceGpuDispatch(ops, xs, 'sum', opts),
  },
];

describe.each(dispatchers)('$name lifecycle', ({ acquires, run }) => {
  describe('success', () => {
    it('pushes one validation scope, pops it once, and releases every buffer once in acquire order', async () => {
      state.stagingFill = (bytes) => new Float32Array(bytes / 4).fill(1).buffer;
      const out = await run(['sin', 'exp']);

      expect(out).not.toBeNull();
      expect(state.events).toEqual(['push:validation', 'pop']);
      expect(state.submits).toBe(1);
      expect(labels(state.acquired)).toEqual(acquires);
      expect(labels(state.released)).toEqual(acquires);
      expectPoolBalanced();
    });

    it('uploads the f32 input and the IEEE uniform, then reads back only the real bytes', async () => {
      const xs = input();
      await run(['sin'], xs);

      expect(state.writes.map((w) => w.label)).toEqual(['chain-a', 'chain-params']);
      const uploaded = state.writes[0].data as Float32Array;
      expect(uploaded).toBeInstanceOf(Float32Array);
      expect(uploaded).toHaveLength(N);
      expect(uploaded[7]).toBe(Math.fround(xs[7]));
      expect(Array.from(state.writes[1].data as Uint32Array)).toEqual([
        N,
        0x7fc00000,
        0x7f800000,
        0xff800000,
      ]);
      const readBytes = acquires.includes('reduce-staging') ? PARTIAL_BYTES : BYTES;
      expect(state.maps).toEqual([
        {
          label: acquires.includes('reduce-staging') ? 'reduce-staging' : 'chain-staging',
          offset: 0,
          size: readBytes,
        },
      ]);
    });

    it('hands an f32 input straight to the device without a copy', async () => {
      const xs = new Float32Array(N).fill(0.5);
      await run(['sin'], xs);
      expect(state.writes[0].data).toBe(xs);
    });

    it.each([1, 2, 3])(
      'ping-pongs %i passes: each pass reads what the last one wrote',
      async (k) => {
        const ops = ['sin', 'exp', 'cos'].slice(0, k);
        await run(ops);

        const [encoder] = state.encoders;
        const chainPasses = encoder.passes.filter((p) => p.label.startsWith('chain:'));
        expect(chainPasses.map((p) => p.label)).toEqual(ops.map((op) => `chain:${op}`));
        let src = 'chain-a';
        let dst = 'chain-b';
        for (const p of chainPasses) {
          expect(p.bound).toEqual([src, dst, 'chain-params']);
          expect(p.workgroups).toBe(WORKGROUPS);
          [src, dst] = [dst, src];
        }
        // After k swaps, `src` is the buffer the last pass wrote.
        const lastWritten = src;
        const reduces = encoder.passes.filter((p) => p.label.startsWith('reduce:'));
        if (reduces.length > 0) {
          expect(reduces).toHaveLength(1);
          expect(reduces[0].bound).toEqual([lastWritten, 'reduce-partials', 'chain-params']);
          expect(reduces[0].workgroups).toBe(WORKGROUPS);
          expect(encoder.copies).toEqual([
            { from: 'reduce-partials', to: 'reduce-staging', size: PARTIAL_BYTES },
          ]);
        } else {
          expect(encoder.copies).toEqual([{ from: lastWritten, to: 'chain-staging', size: BYTES }]);
        }
      }
    );
  });

  describe('null paths leave the scope and the pool balanced', () => {
    it('returns null below the size threshold without touching the device', async () => {
      const small = new Float64Array(N - 1).fill(0.5);
      await expect(run(['sin'], small)).resolves.toBeNull();
      expect(state.deviceCalls).toBe(0);
      expect(state.events).toEqual([]);
      expect(state.acquired).toEqual([]);
    });

    it.each([
      ['an empty chain', [] as string[]],
      ['an unsupported op', ['erfc']],
    ])('returns null for %s without touching the device', async (_name, ops) => {
      await expect(run(ops)).resolves.toBeNull();
      expect(state.deviceCalls).toBe(0);
      expect(state.events).toEqual([]);
      expect(state.acquired).toEqual([]);
    });

    it('honours the per-call gpu option over the global flag, before any device work', async () => {
      await expect(run(['sin', 'exp'], undefined, { gpu: false })).resolves.toBeNull();
      expect(state.deviceCalls).toBe(0);

      disableGpu();
      await expect(run(['sin', 'exp'], undefined, {})).resolves.toBeNull();
      expect(state.deviceCalls).toBe(0);

      await expect(run(['sin', 'exp'], undefined, { gpu: true })).resolves.not.toBeNull();
      expect(state.deviceCalls).toBe(1);
      expect(state.events).toEqual(['push:validation', 'pop']);
    });

    it('returns null when no device exists (no scope, no buffers)', async () => {
      state.device = null;
      await expect(run(['sin'])).resolves.toBeNull();
      expect(state.deviceCalls).toBe(1);
      expect(state.events).toEqual([]);
      expect(state.acquired).toEqual([]);
    });

    it.each([
      ['maxComputeWorkgroupsPerDimension', { maxComputeWorkgroupsPerDimension: WORKGROUPS - 1 }],
      ['maxStorageBufferBindingSize', { maxStorageBufferBindingSize: BYTES - 1 }],
      ['maxBufferSize', { maxBufferSize: BYTES - 1 }],
    ])(
      'returns null on a %s limit AFTER the device is acquired, with no scope pushed',
      async (_n, limit) => {
        Object.assign(state.limits, limit);
        await expect(run(['sin'])).resolves.toBeNull();
        expect(state.deviceCalls).toBe(1);
        expect(state.events).toEqual([]);
        expect(state.acquired).toEqual([]);
        expect(state.submits).toBe(0);
      }
    );

    it('at exactly the limits it still runs', async () => {
      Object.assign(state.limits, {
        maxComputeWorkgroupsPerDimension: WORKGROUPS,
        maxStorageBufferBindingSize: BYTES,
        maxBufferSize: BYTES,
      });
      await expect(run(['sin'])).resolves.not.toBeNull();
      expect(state.events).toEqual(['push:validation', 'pop']);
    });

    it('treats a validation error as null: popped once, nothing read back, buffers released', async () => {
      state.popResult = { message: 'invalid bind group' };
      await expect(run(['sin', 'exp'])).resolves.toBeNull();
      expect(state.events).toEqual(['push:validation', 'pop']);
      expect(state.maps).toEqual([]);
      expectPoolBalanced();
      expect(labels(state.released)).toEqual(acquires);
    });
  });

  describe('a throw between push and pop still balances the scope and releases the pool', () => {
    it.each([
      ['createCommandEncoder throws', () => (state.encoderThrows = true)],
      ['submit throws', () => (state.submitThrows = true)],
    ])('%s', async (_name, arm) => {
      arm();
      await expect(run(['sin', 'exp'])).resolves.toBeNull();
      // The scope was pushed and never popped by the body, so the `finally` pops it.
      expect(state.events).toEqual(['push:validation', 'pop']);
      expect(labels(state.released)).toEqual(acquires);
      expectPoolBalanced();
    });

    it.each(acquires.map((label, i) => [label, i] as const))(
      'acquiring %s fails: only the buffers already held are released, the scope is popped once',
      async (label, i) => {
        state.failAcquire = label;
        await expect(run(['sin', 'exp'])).resolves.toBeNull();
        expect(state.events).toEqual(['push:validation', 'pop']);
        expect(labels(state.acquired)).toEqual(acquires.slice(0, i));
        expect(labels(state.released)).toEqual(acquires.slice(0, i));
        expectPoolBalanced();
      }
    );

    it('a rejected map after the pop does not pop a second time', async () => {
      state.mapRejects = true;
      await expect(run(['sin'])).resolves.toBeNull();
      expect(state.events).toEqual(['push:validation', 'pop']);
      expect(state.maps).toHaveLength(1);
      expectPoolBalanced();
    });

    it('a device lost during the pop is swallowed and the buffers are still released', async () => {
      state.popRejects = true;
      await expect(run(['sin'])).resolves.toBeNull();
      expect(state.events[0]).toBe('push:validation');
      expect(state.maps).toEqual([]);
      expect(labels(state.released)).toEqual(acquires);
      expectPoolBalanced();
    });
  });

  it('queues a concurrent dispatch behind the in-flight one: no second scope or buffer set until the first finishes', async () => {
    let open!: () => void;
    state.mapGate = new Promise<void>((resolve) => {
      open = resolve;
    });

    const first = run(['sin']);
    const second = run(['exp']);
    // Let the first reach its (held) readback; the second must still be waiting its turn.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(state.events).toEqual(['push:validation', 'pop']);
    expect(labels(state.acquired)).toEqual(acquires);
    expect(state.released).toEqual([]);

    open();
    const results = await Promise.all([first, second]);
    expect(results.every((r) => r !== null)).toBe(true);
    expect(state.events).toEqual(['push:validation', 'pop', 'push:validation', 'pop']);
    expectPoolBalanced();
  });
});

describe('elementwiseChainGpuDispatch result', () => {
  it('returns the staged f32 values as-is', async () => {
    const staged = Float32Array.from({ length: N }, (_, i) => i * 0.5);
    state.stagingFill = () => staged.buffer.slice(0) as ArrayBuffer;
    const out = (await elementwiseChainGpuDispatch(['sin'], input())) as Float32Array;
    expect(out).toBeInstanceOf(Float32Array);
    expect(out).toHaveLength(N);
    expect(Array.from(out.subarray(0, 8))).toEqual(Array.from(staged.subarray(0, 8)));
    expect(out[N - 1]).toBe(staged[N - 1]);
  });
});

describe('elementwiseChainReduceGpuDispatch result and gates', () => {
  const partials = Float32Array.from({ length: WORKGROUPS }, (_, i) => i + 1);

  it.each([
    ['sum', (WORKGROUPS * (WORKGROUPS + 1)) / 2],
    ['max', WORKGROUPS],
    ['min', 1],
  ] as Array<[GpuReduceOp, number]>)(
    'folds the partials with %s in f64',
    async (reduce, expected) => {
      state.stagingFill = () => partials.buffer.slice(0) as ArrayBuffer;
      await expect(elementwiseChainReduceGpuDispatch(['sin'], input(), reduce)).resolves.toBe(
        expected
      );
      const reducePass = state.encoders[0].passes.find((p) => p.label.startsWith('reduce:'));
      expect(reducePass?.label).toBe(`reduce:${reduce}`);
      expect(reducePass?.pipeline).toBe(`reduce:${reduce}`);
      expect(state.encoders[0].label).toBe('elementwise-chain-reduce');
    }
  );

  it('declines a reduce op it has no kernel for, before any device work', async () => {
    const result = await elementwiseChainReduceGpuDispatch(['sin'], input(), 'prod' as GpuReduceOp);
    expect(result).toBeNull();
    expect(state.deviceCalls).toBe(0);
    expect(state.events).toEqual([]);
  });

  it('labels the chain dispatch encoder `elementwise-chain`', async () => {
    await elementwiseChainGpuDispatch(['sin'], input());
    expect(state.encoders[0].label).toBe('elementwise-chain');
  });
});
