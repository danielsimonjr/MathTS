import { describe, it, expect } from 'vitest';
import { allocAsHeader } from '../src/wasm-as-header.js';

describe('allocAsHeader pin (P6-9)', () => {
  it('writes buffer, dataStart, byteLength in allocation order', () => {
    const mem = new WebAssembly.Memory({ initial: 1 });
    let nextPtr = 16;
    const mod = {
      __new(size: number, _id: number) {
        const ptr = nextPtr;
        nextPtr += size + 8;
        return ptr;
      },
      __pin(ptr: number) {
        return ptr;
      },
      memory: mem,
    };

    const byteLength = 24;
    const typeId = 5;
    const { headerPtr, bufferPtr } = allocAsHeader(mod, byteLength, typeId);

    expect(bufferPtr).toBeLessThan(headerPtr);
    const dv = new DataView(mem.buffer);
    expect(dv.getUint32(headerPtr + 0, true)).toBe(bufferPtr);
    expect(dv.getUint32(headerPtr + 4, true)).toBe(bufferPtr);
    expect(dv.getUint32(headerPtr + 8, true)).toBe(byteLength);
  });
});
