/**
 * fftshift/ifftshift consolidation guard.
 *
 * There are two typed surfaces over the SAME roll algorithm:
 *   - the PUBLIC `number[]` contract (`../../src/signal/fft-helpers.ts`,
 *     re-exported from the package `index.ts`), and
 *   - the generic `<T>` toolkit member (`../../src/signal/fft.ts`), used by the
 *     complex-FFT toolkit and its own tests.
 *
 * After the dedup consolidation (one `rollBy` algorithm, two thin typed
 * surfaces that delegate to it) both surfaces MUST produce identical rolls on a
 * shared corpus. This test is the regression guard: it goes RED if a future
 * edit re-implements one surface differently from the other.
 */
import { describe, it, expect } from 'vitest';
import {
  fftshift as fftshiftPublic,
  ifftshift as ifftshiftPublic,
} from '../../src/signal/fft-helpers.js';
import {
  fftshift as fftshiftGeneric,
  ifftshift as ifftshiftGeneric,
} from '../../src/signal/fft.js';

// Shared corpus: even and odd lengths (the floor/ceil split only matters for odd
// lengths), plus empty and single-element edge cases.
const CORPUS: number[][] = [
  [],
  [42],
  [0, 1],
  [0, 1, 2],
  [0, 1, 2, 3],
  [0, 1, 2, 3, 4],
  [0, 1, 2, 3, 4, 5, 6, 7],
  [10, -3, 7, 2, 99, -1, 4, 5, 6],
];

describe('fftshift/ifftshift — public number[] surface ≡ generic <T> surface', () => {
  it('fftshift produces identical rolls on both surfaces', () => {
    for (const x of CORPUS) {
      expect(fftshiftPublic(x)).toEqual(fftshiftGeneric(x));
    }
  });

  it('ifftshift produces identical rolls on both surfaces', () => {
    for (const x of CORPUS) {
      expect(ifftshiftPublic(x)).toEqual(ifftshiftGeneric(x));
    }
  });

  it('roundtrips (ifftshift ∘ fftshift = identity) on both surfaces', () => {
    for (const x of CORPUS) {
      expect(ifftshiftPublic(fftshiftPublic(x))).toEqual(x);
      expect(ifftshiftGeneric(fftshiftGeneric(x))).toEqual(x);
    }
  });

  it('matches the numpy.fft convention: fftshift rolls by floor(n/2)', () => {
    // numpy: fftshift([0,1,2,3,4,5,6,7]) -> [4,5,6,7,0,1,2,3]
    expect(fftshiftPublic([0, 1, 2, 3, 4, 5, 6, 7])).toEqual([4, 5, 6, 7, 0, 1, 2, 3]);
    // odd length: ifftshift is the true inverse (rolls by ceil(n/2))
    expect(fftshiftPublic([0, 1, 2, 3, 4])).toEqual([2, 3, 4, 0, 1]);
    expect(ifftshiftPublic([2, 3, 4, 0, 1])).toEqual([0, 1, 2, 3, 4]);
  });
});
