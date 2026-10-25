/**
 * Seeded pseudo-random number generation (Mulberry32) and Box–Muller normal pairs.
 *
 * Mulberry32 is a small, fast 32-bit PRNG with period 2^32. It is **not**
 * cryptographically secure — use only for reproducible simulation and sampling.
 *
 * Reference: Tommy Ettinger,
 * https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */

/**
 * Create a Mulberry32 PRNG seeded with `seed`.
 *
 * Returns a closure that yields uniformly distributed floats in [0, 1) on
 * each call. The seed is coerced with `seed | 0`. Separate calls with the
 * same seed do not share state.
 *
 * @param seed - Integer seed (coerced with `| 0`).
 * @returns A function that returns the next U[0, 1) sample.
 *
 * @example
 * ```ts
 * const rng = mulberry32(42);
 * rng(); // 0.6011037519201636
 * ```
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  };
}

/**
 * Generate a pair of independent N(0, 1) samples from two U(0, 1) inputs via
 * the Box–Muller transform.
 *
 * @param u1 - First uniform in [0, 1); clamped away from 0 internally.
 * @param u2 - Second uniform in [0, 1).
 * @returns Two independent standard normal samples.
 *
 * @example
 * ```ts
 * const [z0, z1] = boxMuller(0.3, 0.7);
 * Number.isFinite(z0); // true
 * boxMuller(0, 0.5); // u1 === 0 is clamped; result is not NaN
 * ```
 */
export function boxMuller(u1: number, u2: number): [number, number] {
  // Clamp u1 away from 0 to avoid log(0).
  const clamped = u1 === 0 ? Number.EPSILON : u1;
  const r = Math.sqrt(-2 * Math.log(clamped));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

const FNV_OFFSET = 0x811c9dc5; // 2166136261 — FNV-1a 32 empty string → 0x811c9dc5
const FNV_PRIME = 0x01000193; // 16777619 — ASCII "a" → 0xe40c292c

/**
 * FNV-1a 32 over raw bytes. Published vectors: `""` → `0x811c9dc5`, `"a"` → `0xe40c292c`.
 *
 * `fork` payload for parent seed 42 and string label `'a'`:
 * little-endian `42,0,0,0`, tag byte `1`, then UTF-8 `97` → child seed `1619994241`.
 */
function fnv1a32(bytes: Uint8Array): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

const textEncoder = new TextEncoder();

function coerceSeedInt(seed: number | string): number {
  if (typeof seed === 'number') {
    return seed | 0;
  }
  if (typeof seed === 'string') {
    return fnv1a32(textEncoder.encode(seed)) | 0;
  }
  throw new TypeError('seed must be a number or a string');
}

function mixFork(parentSeed: number, label: string | number): number {
  const payload: number[] = [
    (parentSeed >>> 0) & 0xff,
    (parentSeed >>> 8) & 0xff,
    (parentSeed >>> 16) & 0xff,
    (parentSeed >>> 24) & 0xff,
  ];
  if (typeof label === 'number') {
    const n = label | 0;
    payload.push(0, (n >>> 0) & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
  } else if (typeof label === 'string') {
    payload.push(1);
    for (const b of textEncoder.encode(label)) payload.push(b);
  } else {
    throw new TypeError('fork label must be a string or a number');
  }
  return fnv1a32(new Uint8Array(payload)) | 0;
}

/**
 * Instance-scoped Mulberry32 stream with optional string seeds, Box–Muller normals,
 * integer draws, and splittable child streams.
 */
export interface SeededRng {
  /** Next U[0, 1) from this stream. Does not touch the normal spare. */
  next(): number;
  /**
   * Integer in `[0, maxExclusive)`.
   *
   * @throws {RangeError} When `maxExclusive` is not an integer in `[1, 4294967296]`.
   */
  nextInt(maxExclusive: number): number;
  /**
   * N(0, 1) via {@link boxMuller}. The second sample of the pair is cached on this
   * instance only. `next`, `nextInt`, and `fork` do not read or clear that cache.
   */
  normal(): number;
  /**
   * Child stream fixed by this instance's coerced seed and `label`.
   * Does not advance this stream and does not read this stream's normal spare.
   */
  fork(label: string | number): SeededRng;
  /** Int32 seed actually used. Not the evolving PRNG state. */
  readonly seed: number;
}

function makeSeededRng(seedInt: number): SeededRng {
  const uniform = mulberry32(seedInt);
  let spare: number | null = null;
  const rng: SeededRng = {
    seed: seedInt,
    next: () => uniform(),
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
        throw new RangeError('maxExclusive must be an integer in [1, 4294967296]');
      }
      return Math.floor(uniform() * maxExclusive);
    },
    normal(): number {
      if (spare !== null) {
        const z = spare;
        spare = null;
        return z;
      }
      const pair = boxMuller(uniform(), uniform());
      spare = pair[1];
      return pair[0];
    },
    fork(label: string | number): SeededRng {
      return makeSeededRng(mixFork(seedInt, label));
    },
  };
  return Object.freeze(rng);
}

/**
 * Create a forkable Mulberry32 stream. Number seeds use `seed | 0` (same as {@link mulberry32}).
 * String seeds are FNV-1a 32 over UTF-8. Not cryptographically secure.
 *
 * @param seed - Integer (coerced with `| 0`) or string (hashed to int32).
 * @returns A frozen {@link SeededRng} instance.
 * @throws {TypeError} When `seed` is neither a number nor a string.
 *
 * @example
 * ```ts
 * import { createSeededRng } from '@danielsimonjr/mathts-core';
 *
 * const rng = createSeededRng(42);
 * rng.next(); // 0.6011037519201636
 * rng.fork('a').next(); // 0.668102843221277
 * createSeededRng('a').seed; // -468965076
 * ```
 */
export function createSeededRng(seed: number | string): SeededRng {
  return makeSeededRng(coerceSeedInt(seed));
}
