/**
 * #904 — a binary op reads a strided view on the right-hand side by its
 * logical elements, not by the raw parent buffer.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';

describe('#904 strided view as the right-hand operand', () => {
  it('same-shape add reads the logical elements of a step-2 view', () => {
    const base = new Tensor([6], new Float64Array([0, 1, 2, 3, 4, 5]));
    const view = base.slice([{ step: 2 }]);
    const a = new Tensor([3], new Float64Array([0, 0, 0]));
    expect([...a.add(view).contiguous().data]).toEqual([0, 2, 4]);
  });

  it('in-place mul_ reads the logical elements of a view', () => {
    const base = new Tensor([6], new Float64Array([0, 1, 2, 3, 4, 5]));
    const view = base.slice([{ step: 2 }]);
    const a = new Tensor([3], new Float64Array([1, 1, 1]));
    expect([...a.mul_(view).data]).toEqual([0, 2, 4]);
  });
});
