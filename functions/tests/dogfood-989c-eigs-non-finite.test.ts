import { describe, it, expect } from 'vitest';
import { eigs } from '../src/index.js';

// eigs still throws a RangeError for a non-finite entry (#989). Since #1561 the
// public `eigs` is the mathjs factory itself, whose finite-entry guard raises
// its own message; the former native `eig` message belonged to the removed
// native bypass. mathjs 15.3.0 itself returns silently wrong values for a NaN
// entry, so the throw is a deliberate, more-correct divergence.
describe('eigs with a non-finite entry (#989)', () => {
  it('throws RangeError for a NaN entry', () => {
    expect(() =>
      eigs([
        [NaN, 1],
        [3, 2],
      ])
    ).toThrow('eigs: matrix entries must be finite (got NaN)');
  });
});
