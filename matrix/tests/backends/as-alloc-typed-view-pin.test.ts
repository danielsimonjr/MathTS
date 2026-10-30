import { describe, it, expect } from 'vitest';
import {
  AS_ID_FLOAT64_ARRAY,
  AS_ID_INT32_ARRAY,
  allocAsTypedView,
} from '../../src/backends/wasm/as-typed-array.js';

/**
 * P6-9: `allocAsTypedView` now delegates the header write to core's `allocAsHeader`. This pins what
 * the caller sees: the allocation order on the runtime, the 12-byte header, and that the returned
 * view aliases the pinned data buffer in linear memory.
 */

function makeRuntime() {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const calls: string[] = [];
  let next = 64;
  return {
    memory,
    calls,
    __new(size: number, id: number) {
      const ptr = next;
      next += size + 8;
      calls.push(`new(${size},${id})=${ptr}`);
      return ptr;
    },
    __pin(ptr: number) {
      calls.push(`pin(${ptr})`);
      return ptr;
    },
  };
}

describe('allocAsTypedView (P6-9 pin)', () => {
  it('Float64Array: buffer (id 1) then header (id 5), both pinned, header words and aliasing view', () => {
    const rt = makeRuntime();
    const out = allocAsTypedView(rt, 5 * 8, 5, AS_ID_FLOAT64_ARRAY, Float64Array);

    expect(rt.calls).toEqual(['new(40,1)=64', 'pin(64)', 'new(12,5)=112', 'pin(112)']);
    expect(out.bufferPtr).toBe(64);
    expect(out.headerPtr).toBe(112);
    expect(out.byteLength).toBe(40);
    expect(out.length).toBe(5);

    const dv = new DataView(rt.memory.buffer);
    expect(dv.getUint32(112, true)).toBe(64);
    expect(dv.getUint32(116, true)).toBe(64);
    expect(dv.getUint32(120, true)).toBe(40);

    expect(out.view).toBeInstanceOf(Float64Array);
    expect(out.view.length).toBe(5);
    expect(out.view.buffer).toBe(rt.memory.buffer);
    expect(out.view.byteOffset).toBe(64);
    out.view.set([1.5, -2, 3, 4, 5]);
    expect(Array.from(new Float64Array(rt.memory.buffer, 64, 5))).toEqual([1.5, -2, 3, 4, 5]);
  });

  it('Int32Array: header id 6 and a view of the requested length', () => {
    const rt = makeRuntime();
    const out = allocAsTypedView(rt, 3 << 2, 3, AS_ID_INT32_ARRAY, Int32Array);

    expect(rt.calls).toEqual(['new(12,1)=64', 'pin(64)', 'new(12,6)=84', 'pin(84)']);
    const dv = new DataView(rt.memory.buffer);
    expect(dv.getUint32(84, true)).toBe(64);
    expect(dv.getUint32(88, true)).toBe(64);
    expect(dv.getUint32(92, true)).toBe(12);
    expect(out.view).toBeInstanceOf(Int32Array);
    expect(out.view.length).toBe(3);
    expect(out.view.byteOffset).toBe(64);
  });

  it('the view is not the header: the header words are untouched by writes through the view', () => {
    const rt = makeRuntime();
    const out = allocAsTypedView(rt, 4 * 8, 4, AS_ID_FLOAT64_ARRAY, Float64Array);
    out.view.fill(9);
    const dv = new DataView(rt.memory.buffer);
    expect(dv.getUint32(out.headerPtr + 8, true)).toBe(32);
  });
});
