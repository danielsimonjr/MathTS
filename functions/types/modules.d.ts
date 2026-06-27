/**
 * Ambient declarations for untyped third-party JS dependencies.
 *
 * These packages ship no type declarations and have no @types package
 * installed. The declarations below describe only the small surface area
 * MathTS uses; call sites narrow further with explicit assertions.
 */

declare module 'seedrandom' {
  /** Create a seeded pseudo-random number generator returning floats in [0, 1). */
  const seedrandom: (seed?: string | number, options?: object) => () => number;
  export default seedrandom;
}

declare module 'javascript-natural-sort' {
  /** Natural-order comparator suitable for Array.prototype.sort. */
  const naturalSort: (a: unknown, b: unknown) => number;
  export default naturalSort;
}
