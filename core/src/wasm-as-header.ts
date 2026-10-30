/**
 * AssemblyScript managed ArrayBuffer + typed-array header allocation.
 *
 * Shared by `functions` WASM bridges and `matrix` AS backend allocation.
 * Exported only from `@danielsimonjr/mathts-core/internal`.
 */

export interface AsHeaderRuntime {
  __new(size: number, id: number): number;
  __pin(ptr: number): number;
  memory: WebAssembly.Memory;
}

/** Pin a data buffer and write the 12-byte AS typed-array header. */
export function allocAsHeader(
  mod: AsHeaderRuntime,
  byteLength: number,
  typeId: number
): { headerPtr: number; bufferPtr: number } {
  const bufferPtr = mod.__pin(mod.__new(byteLength, 1)) >>> 0;
  const headerPtr = mod.__new(12, typeId) >>> 0;
  mod.__pin(headerPtr);
  const dv = new DataView(mod.memory.buffer);
  dv.setUint32(headerPtr + 0, bufferPtr, true);
  dv.setUint32(headerPtr + 4, bufferPtr, true);
  dv.setUint32(headerPtr + 8, byteLength, true);
  return { headerPtr, bufferPtr };
}
