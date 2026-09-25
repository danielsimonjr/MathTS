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
    // Annotating real values checks the imported types exist and have the documented shape.
    const nested: NestedArray = [
      [1, 2],
      [3, 4],
    ];
    const spec: EinsumSpec = {
      contractions: [
        {
          pair: [
            [0, 1],
            [1, 0],
          ],
        },
      ],
      free: [
        { operand: 0, axis: 0 },
        { operand: 1, axis: 1 },
      ],
    };
    expect(nested).toHaveLength(2);
    expect(spec.contractions).toHaveLength(1);
    expect(spec.free).toHaveLength(2);
  });
});
