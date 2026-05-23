/**
 * Smoke test for tensor/src/index.ts (package entry barrel)
 *
 * Asserts that `Tensor` is exported as a constructor.
 */
import { describe, it, expect } from 'vitest';
import * as tensorPkg from '../src/index.js';
import type { NestedArray, EinsumSpec } from '../src/index.js';

describe('tensor/src/index.ts – package entry smoke test', () => {
  it('exports Tensor as a constructor function', () => {
    expect(typeof tensorPkg.Tensor).toBe('function');
  });

  it('can construct a simple Tensor via the exported class', () => {
    const data = new Float64Array([1, 2, 3, 4, 5, 6]);
    const t = new tensorPkg.Tensor([2, 3], data);
    expect(t.shape).toEqual([2, 3]);
    expect(t.shape.length).toBe(2);
    expect(t.data.length).toBe(6);
  });

  it('NestedArray and EinsumSpec types are importable (compile-time check)', () => {
    type _CheckNestedArray = NestedArray;
    type _CheckEinsumSpec = EinsumSpec;
    expect(true).toBe(true);
  });
});
