import { describe, it, expect } from 'vitest';
import { eigs } from '../src/index.js';

// eigs passes the RangeError of the native solver through for a non-finite
// entry, where the factory fallback returned NaN or ran for ever (#989).
describe('eigs with a non-finite entry (#989)', () => {
  it('throws RangeError for a NaN entry', () => {
    expect(() =>
      eigs([
        [NaN, 1],
        [3, 2],
      ])
    ).toThrow('eig: matrix has a non-finite entry');
  });
});
