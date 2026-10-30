import { describe, it, expect } from 'vitest';
import { allocAsHeader, type AsHeaderRuntime } from '../src/wasm-as-header.js';

/**
 * P6-9 pins for the shared AssemblyScript array-header writer. Three callers rely on its exact
 * allocation order and on the 12-byte header layout `{ buffer, dataStart, byteLength }`:
 * `matrix` `allocAsTypedView`, and `functions` `withAsTyped`. The stub below records every call
 * the helper makes, so the order, the arguments and the pinned pointer are asserted, not just the
 * bytes that end up in memory.
 */

type Call =
  | { fn: '__new'; size: number; id: number; returned: number }
  | { fn: '__pin'; ptr: number; returned: number };

function makeRuntime(
  opts: { start?: number; growOnNew?: boolean } = {}
): AsHeaderRuntime & { calls: Call[]; memory: WebAssembly.Memory } {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 8 });
  const calls: Call[] = [];
  let next = opts.start ?? 16;
  return {
    calls,
    memory,
    __new(size: number, id: number) {
      const ptr = next;
      next += size + 8;
      if (opts.growOnNew) memory.grow(1);
      calls.push({ fn: '__new', size, id, returned: ptr });
      return ptr;
    },
    __pin(ptr: number) {
      calls.push({ fn: '__pin', ptr, returned: ptr });
      return ptr;
    },
  };
}

describe('allocAsHeader pin (P6-9)', () => {
  it('allocates the data buffer (id 1), pins it, then allocates and pins the 12-byte header', () => {
    const rt = makeRuntime();
    const { headerPtr, bufferPtr } = allocAsHeader(rt, 24, 5);

    expect(rt.calls).toEqual([
      { fn: '__new', size: 24, id: 1, returned: 16 },
      { fn: '__pin', ptr: 16, returned: 16 },
      { fn: '__new', size: 12, id: 5, returned: 48 },
      { fn: '__pin', ptr: 48, returned: 48 },
    ]);
    expect(bufferPtr).toBe(16);
    expect(headerPtr).toBe(48);
  });

  it('passes the typed-array class id through to the header allocation', () => {
    for (const typeId of [5, 6, 0, 99]) {
      const rt = makeRuntime();
      allocAsHeader(rt, 8, typeId);
      const news = rt.calls.filter((c) => c.fn === '__new');
      expect(news.map((c) => c.id)).toEqual([1, typeId]);
    }
  });

  it('writes buffer, dataStart and byteLength as little-endian u32 at offsets 0, 4 and 8', () => {
    const rt = makeRuntime();
    const { headerPtr, bufferPtr } = allocAsHeader(rt, 0x0201, 6);
    const bytes = new Uint8Array(rt.memory.buffer, headerPtr, 12);
    const word = (o: number) =>
      (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
    expect(word(0)).toBe(bufferPtr);
    expect(word(4)).toBe(bufferPtr);
    expect(word(8)).toBe(0x0201);
    expect(Array.from(bytes.subarray(8, 12))).toEqual([0x01, 0x02, 0x00, 0x00]);
    expect(Array.from(bytes.subarray(0, 4))).toEqual([bufferPtr & 0xff, bufferPtr >>> 8, 0, 0]);
  });

  it('writes only the 12 header bytes and nothing around them', () => {
    const rt = makeRuntime();
    const before = new Uint8Array(rt.memory.buffer).slice();
    const { headerPtr } = allocAsHeader(rt, 40, 5);
    const after = new Uint8Array(rt.memory.buffer);
    for (let i = 0; i < after.length; i++) {
      const inHeader = i >= headerPtr && i < headerPtr + 12;
      if (!inHeader) expect(after[i], `byte ${i}`).toBe(before[i]);
    }
  });

  it('a zero-length array still gets a header with byteLength 0', () => {
    const rt = makeRuntime();
    const { headerPtr, bufferPtr } = allocAsHeader(rt, 0, 5);
    const dv = new DataView(rt.memory.buffer);
    expect(dv.getUint32(headerPtr + 0, true)).toBe(bufferPtr);
    expect(dv.getUint32(headerPtr + 4, true)).toBe(bufferPtr);
    expect(dv.getUint32(headerPtr + 8, true)).toBe(0);
    expect(rt.calls[0]).toMatchObject({ fn: '__new', size: 0, id: 1 });
  });

  it('reads memory.buffer after the allocations: a grow inside __new does not break the write', () => {
    const rt = makeRuntime({ growOnNew: true });
    const initialBytes = rt.memory.buffer.byteLength;
    const { headerPtr, bufferPtr } = allocAsHeader(rt, 16, 5);
    expect(rt.memory.buffer.byteLength).toBeGreaterThan(initialBytes);
    const dv = new DataView(rt.memory.buffer);
    expect(dv.getUint32(headerPtr + 0, true)).toBe(bufferPtr);
    expect(dv.getUint32(headerPtr + 8, true)).toBe(16);
  });

  it('uses the pointer that __pin returned for the buffer, not the one __new returned', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const pinned: number[] = [];
    const rt: AsHeaderRuntime = {
      memory,
      __new: (_size, id) => (id === 1 ? 64 : 128),
      __pin: (ptr) => {
        pinned.push(ptr);
        return ptr === 64 ? 256 : ptr;
      },
    };
    const { headerPtr, bufferPtr } = allocAsHeader(rt, 8, 5);
    expect(bufferPtr).toBe(256);
    expect(headerPtr).toBe(128);
    expect(pinned).toEqual([64, 128]);
    const dv = new DataView(memory.buffer);
    expect(dv.getUint32(128, true)).toBe(256);
    expect(dv.getUint32(132, true)).toBe(256);
  });

  it('two successive allocations do not overlap and each keeps its own header', () => {
    const rt = makeRuntime();
    const first = allocAsHeader(rt, 16, 5);
    const second = allocAsHeader(rt, 32, 6);
    expect(second.bufferPtr).toBeGreaterThan(first.headerPtr);
    const dv = new DataView(rt.memory.buffer);
    expect(dv.getUint32(first.headerPtr + 8, true)).toBe(16);
    expect(dv.getUint32(second.headerPtr + 8, true)).toBe(32);
    expect(dv.getUint32(first.headerPtr, true)).toBe(first.bufferPtr);
    expect(dv.getUint32(second.headerPtr, true)).toBe(second.bufferPtr);
  });
});
