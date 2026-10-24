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
 * each call. The seed is coerced with `seed | 0`.
 *
 * @param seed - Integer seed (coerced with `| 0`).
 * @returns A function that returns the next U[0, 1) sample.
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
 */
export function boxMuller(u1: number, u2: number): [number, number] {
  // Clamp u1 away from 0 to avoid log(0).
  const clamped = u1 === 0 ? Number.EPSILON : u1;
  const r = Math.sqrt(-2 * Math.log(clamped));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}
