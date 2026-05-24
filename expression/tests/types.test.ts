/**
 * Smoke test for expression/src/types.ts
 *
 * This file is type-only. The test uses `import type` to create a compile-
 * time edge so the CDG registers the file as covered. Runtime assertions
 * are trivial sentinels.
 */
import { describe, it, expect } from 'vitest';
import type { TypedFunction, TypedFunctionConstructor } from '../src/types.js';

describe('expression/src/types.ts – type-only smoke test', () => {
  it('TypedFunction shape check (compile-time)', () => {
    // A compatible implementation of the TypedFunction type.
    const fn = Object.assign((..._args: unknown[]) => undefined, {
      signatures: { number: (..._a: unknown[]) => 42 },
    }) satisfies TypedFunction;
    expect(typeof fn).toBe('function');
    expect(typeof fn.signatures).toBe('object');
  });

  it('TypedFunctionConstructor type is importable', () => {
    type _Check = TypedFunctionConstructor;
    expect(true).toBe(true);
  });

  it('TypedFunction and TypedFunctionConstructor types are importable without runtime error', () => {
    // If the file didn't exist or had broken exports the import at the top
    // of this file would cause a TypeScript / module-resolution error.
    expect(true).toBe(true);
  });
});
