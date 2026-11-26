/**
 * Leaf types for the default-instance bind. `named-instance-exports.ts` must
 * not type-import `src/index.ts`: that edge was a type-only cycle (index →
 * named-instance-exports → index). This module imports nothing from the rest
 * of compat.
 *
 * @packageDocumentation
 */

/** Factory bag `create` accepts, matching `src/index.ts`. */
export type CompatFactoryInput = Record<string, unknown> | readonly unknown[];

/**
 * Config bag the default-instance wrappers pass into `create`. Structural so
 * this file stays a leaf; it is assignable to `MathJSConfig`.
 */
export interface BoundInstanceConfig {
  relTol: number;
  absTol: number;
  matrix: 'Matrix' | 'Array';
  number: string;
  numberFallback: string;
  precision: number;
  predictable: boolean;
  randomSeed: string | null;
  legacySubset: boolean;
}

/**
 * `create` from `src/index.ts` is stored here. `never[]` is the input-position
 * top type (same pattern as `SignatureImpl`), so the real `create` is assignable.
 */
export type CompatCreate = (...args: never[]) => Record<string, unknown>;
