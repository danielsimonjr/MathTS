import { describe, it, expect } from 'vitest';
import { withAsF64, withAsI32 } from '../src/wasm/bridges/common.js';

/**
 * P6-9: `withAsTyped` allocates its managed arrays through core's `allocAsHeader`. The stub
 * AssemblyScript runtime stands in for the binary and logs every call, so the order the bridge
 * relies on (buffer, header, copy-in, body, unpin per allocation, then `heap_reset`) is pinned.
 * `functions/tests/wasm-heap-bounded.test.ts` covers the same path against the real binary.
 */

function makeRuntime() {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const calls: string[] = [];
  let next = 64;
  return {
    memory,
    calls,
    __new(size: number, id: number) {
      // The AssemblyScript allocator returns 16-byte aligned payloads.
      const ptr = (next + 15) & ~15;
      next = ptr + size;
      calls.push(`new(${size},${id})=${ptr}`);
      return ptr;
    },
    __pin(ptr: number) {
      calls.push(`pin(${ptr})`);
      return ptr;
    },
    __unpin(ptr: number) {
      calls.push(`unpin(${ptr})`);
    },
    heap_reset() {
      calls.push('heap_reset');
      next = 64;
    },
  };
}

describe('withAsF64 / withAsI32 allocation order (P6-9 pin)', () => {
  it('f64: allocates buffer then header per input, copies in, runs body, then unpins and resets', () => {
    const rt = makeRuntime();
    const seen: { headers: number[]; copied: number[][] } = { headers: [], copied: [] };
    const out = withAsF64(rt, [Float64Array.of(1, 2, 3), Float64Array.of(4, 5)], (mod, headers) => {
      rt.calls.push('body');
      seen.headers = headers;
      // The data of each input sits at the dataStart word of its header, and the header word at +8
      // holds its byte length.
      const dv = new DataView(mod.memory.buffer);
      for (const h of headers) {
        const dataStart = dv.getUint32(h + 4, true);
        const len = dv.getUint32(h + 8, true) / 8;
        seen.copied.push(Array.from(new Float64Array(mod.memory.buffer, dataStart, len)));
      }
      return 'done';
    });

    expect(out).toBe('done');
    expect(rt.calls).toEqual([
      'new(24,1)=64',
      'pin(64)',
      'new(12,5)=96',
      'pin(96)',
      'new(16,1)=112',
      'pin(112)',
      'new(12,5)=128',
      'pin(128)',
      'body',
      'unpin(96)',
      'unpin(64)',
      'unpin(128)',
      'unpin(112)',
      'heap_reset',
    ]);
    expect(seen.headers).toEqual([96, 128]);
    expect(seen.copied).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
  });

  it('i32: header id 6 and 4-byte elements', () => {
    const rt = makeRuntime();
    withAsI32(rt, [Int32Array.of(7, 8, 9, 10)], (mod, headers) => {
      const dv = new DataView(mod.memory.buffer);
      expect(dv.getUint32(headers[0] + 8, true)).toBe(16);
      return 0;
    });
    expect(rt.calls.slice(0, 4)).toEqual(['new(16,1)=64', 'pin(64)', 'new(12,6)=80', 'pin(80)']);
    expect(rt.calls.slice(-3)).toEqual(['unpin(80)', 'unpin(64)', 'heap_reset']);
  });

  it('a throwing body returns null and still unpins and resets', () => {
    const rt = makeRuntime();
    const out = withAsF64(rt, [Float64Array.of(1)], () => {
      throw new Error('kernel failed');
    });
    expect(out).toBeNull();
    expect(rt.calls.slice(-3)).toEqual(['unpin(80)', 'unpin(64)', 'heap_reset']);
  });

  it('a runtime without __new returns null before touching memory', () => {
    const rt = makeRuntime() as Record<string, unknown>;
    delete rt.__new;
    expect(withAsF64(rt as never, [Float64Array.of(1)], () => 1)).toBeNull();
  });
});
