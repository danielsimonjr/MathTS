/**
 * Shared AssemblyScript managed-runtime allocation for typed arrays.
 *
 * Both {@link ../WASMBackend.ts} and {@link ../WasmLoader.ts} pin a data
 * buffer, allocate a 12-byte header, and write `[dataStart, dataStart,
 * byteLength]` as little-endian u32s before constructing the JS view. Not
 * exported from the package barrel.
 */

/** Minimal AS runtime surface needed to allocate managed typed arrays. */
export interface AsRuntime {
  __new: (size: number, id: number) => number;
  __pin: (ptr: number) => number;
  memory: WebAssembly.Memory;
}

/** AssemblyScript runtime type ids (see `assembly/build/mathts.js`). */
export const AS_ID_ARRAY_BUFFER = 1;
export const AS_ID_FLOAT64_ARRAY = 5;
export const AS_ID_INT32_ARRAY = 6;
/** AS typed-array header is { buffer, dataStart, byteLength } = 3 × u32. */
export const AS_HEADER_BYTES = 12;
export const AS_F64_ALIGN_SHIFT = 3;
export const AS_I32_ALIGN_SHIFT = 2;

/**
 * Pin a new ArrayBuffer, write the AS typed-array header, and return views.
 *
 * @param module - Loaded AS module exports (`__new`, `__pin`, `memory`).
 * @param byteLength - Total data bytes (`length * elementBytes` or `length << shift`).
 * @param length - Element count for the returned typed-array view.
 * @param typeId - AS class id for the header object (`Float64Array` / `Int32Array`).
 * @param Ctor - JS typed-array constructor for the data view.
 */
export function allocAsTypedView<T extends Float64Array | Int32Array>(
  module: AsRuntime,
  byteLength: number,
  length: number,
  typeId: number,
  Ctor: new (b: ArrayBuffer, o: number, l: number) => T
): {
  headerPtr: number;
  bufferPtr: number;
  view: T;
  byteLength: number;
  length: number;
} {
  const bufferPtr = module.__pin(module.__new(byteLength, AS_ID_ARRAY_BUFFER)) >>> 0;
  const headerPtr = module.__new(AS_HEADER_BYTES, typeId) >>> 0;
  module.__pin(headerPtr);

  const dv = new DataView(module.memory.buffer);
  dv.setUint32(headerPtr + 0, bufferPtr, true);
  dv.setUint32(headerPtr + 4, bufferPtr, true);
  dv.setUint32(headerPtr + 8, byteLength, true);

  const view = new Ctor(module.memory.buffer, bufferPtr, length) as T;
  return { headerPtr, bufferPtr, view, byteLength, length };
}
