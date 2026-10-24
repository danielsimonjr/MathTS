/**
 * Worker-bundle copies of core numeric helpers.
 *
 * Canonical implementations: `mulberry32` and `rowMajorStrides` in
 * `@danielsimonjr/mathts-core`. This file is a copy because the worker entry
 * (`dist/worker.js`) cannot import core:
 *
 * - tsdown externalizes package deps, so a bare `@danielsimonjr/mathts-core`
 *   import in the worker would not resolve in a browser worker.
 * - `deps.alwaysBundle` / `noExternal` on the core barrel inlines core's
 *   pre-bundled `dist/index.js` (typed-function, Unit, factory, …), not the
 *   two numeric functions.
 * - This package exports `./worker` types from `dist/worker.d.ts`. A source
 *   import of core would make those types depend on core without a published
 *   dependency.
 *
 * `@danielsimonjr/mathts-core` is a **devDependency** only (parity test).
 * Keep the bodies in lockstep with core; `tests/worker-numerics.test.ts` pins
 * that.
 */

/**
 * Row-major strides for a shape array (worker copy).
 */
export function _tdRowMajorStrides(shape: readonly number[]): number[] {
  const strides = new Array<number>(shape.length);
  let stride = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    strides[i] = stride;
    stride *= shape[i];
  }
  return strides;
}

/**
 * Mulberry32 seeded PRNG (worker copy).
 *
 * Reference: Tommy Ettinger,
 * https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 * Period: 2^32.
 */
export function _workerMulberry32(seed: number): () => number {
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
