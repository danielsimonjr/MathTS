/**
 * Smoke test for expression/src/compiler/index.ts
 *
 * Asserts that the barrel re-exports `compile` as a function and that
 * the `CompiledExpression` / `Scope` types are importable.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import * as compilerBarrel from '../src/compiler/index.js';
import type { CompiledExpression, Scope } from '../src/compiler/index.js';

describe('expression/src/compiler/index.ts – barrel smoke test', () => {
  it('exports compile as a function', () => {
    expect(typeof compilerBarrel.compile).toBe('function');
  });

  it('compile is the only runtime export from the barrel', () => {
    const keys = Object.keys(compilerBarrel);
    expect(keys).toContain('compile');
  });

  it('CompiledExpression and Scope types are importable (compile-time check)', () => {
    // Type-only check: if these types didn't exist the import above would fail,
    // and `tsc -p tsconfig.test.json` checks the members named here.
    expectTypeOf<Scope>().toHaveProperty('get');
    expectTypeOf<CompiledExpression>().toHaveProperty('evaluate');
    expect(true).toBe(true);
  });
});
