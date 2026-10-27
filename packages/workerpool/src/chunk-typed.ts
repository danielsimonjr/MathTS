/**
 * Slice-based chunking for typed arrays passed to worker kernels.
 *
 * Chunks are produced with `slice()` (not `subarray()`): a subarray shares the
 * full underlying ArrayBuffer, so passing `chunk.buffer` with `start: 0` to a
 * worker kernel would read the wrong region for every chunk past the first.
 */

/**
 * Split a typed array into `slice()` copies of at most `chunkSize` elements.
 *
 * Each chunk owns its buffer. A `subarray` shares the parent ArrayBuffer, so a
 * worker that reads `chunk.buffer` from index 0 would see the wrong region for
 * every chunk after the first.
 *
 * @internal
 * @param data - Source `Float64Array` or `Int32Array`.
 * @param chunkSize - Maximum length of each chunk.
 * @returns Chunks in source order. The last chunk may be shorter.
 *
 * @example
 * ```ts
 * import { chunkTyped } from '@danielsimonjr/mathts-workerpool';
 * const chunks = chunkTyped(Float64Array.from([1, 2, 3, 4, 5]), 2);
 * chunks.map((c) => c.length); // [2, 2, 1]
 * chunks[1].byteLength === 16; // true — 2 f64s, not the parent buffer
 * ```
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
 * Split two same-kind typed arrays into aligned `slice()` pairs.
 *
 * Each pair uses `a`'s index range for both operands. Pair lengths match. The
 * last pair may be short. Do not fold this into `chunkTyped` with a pair flag:
 * the loops stay separate so a missed `b` slice cannot hide behind an `if`.
 *
 * @internal
 * @param a - First operand.
 * @param b - Second operand. Sliced with the same `[i, end)` as `a`.
 * @param chunkSize - Maximum length of each pair.
 * @returns Aligned pairs in source order.
 *
 * @example
 * ```ts
 * import { chunkPairTyped } from '@danielsimonjr/mathts-workerpool';
 * const pairs = chunkPairTyped(
 *   Float64Array.from([1, 2, 3, 4, 5]),
 *   Float64Array.from([10, 20, 30, 40, 50]),
 *   2
 * );
 * pairs.length; // 3
 * pairs[2][0].length; // 1
 * pairs[2][1][0]; // 50
 * ```
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
