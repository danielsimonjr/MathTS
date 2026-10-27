/**
 * Slice-based chunking for typed arrays passed to worker kernels.
 *
 * Chunks are produced with `slice()` (not `subarray()`): a subarray shares the
 * full underlying ArrayBuffer, so passing `chunk.buffer` with `start: 0` to a
 * worker kernel would read the wrong region for every chunk past the first.
 */

/**
 * @internal
 */
export function chunkTyped<T extends Float64Array | Int32Array>(data: T, chunkSize: number): T[] {
  const chunks: T[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, data.length);
    chunks.push(data.slice(i, end) as T);
  }
  return chunks;
}

/**
 * @internal
 */
export function chunkPairTyped<T extends Float64Array | Int32Array>(
  a: T,
  b: T,
  chunkSize: number
): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < a.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, a.length);
    pairs.push([a.slice(i, end) as T, b.slice(i, end) as T]);
  }
  return pairs;
}
