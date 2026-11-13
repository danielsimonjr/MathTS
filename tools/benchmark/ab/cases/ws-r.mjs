import { mulberry32 } from '../util.mjs';

/**
 * WS-R kernel routing: the public `median` and `fft` against main (#901, #933).
 *
 * `median` selects on one `Float64Array` copy instead of flattening to a nested JS array
 * first. `fft(number[])` takes the flat kernel for every length from 64 up: two split
 * buffers go in, no interleaved copy and no recursive path for a length that is not a power
 * of two. The `sort` row is an unchanged path on both sides and shows the noise of the run.
 */
export const entry = '@danielsimonjr/mathts-functions';

function floats(n, seed) {
  const r = mulberry32(seed);
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = r() * 2 - 1;
  return a;
}

/** Equal lengths and every real and imaginary part within `tol` of the largest magnitude. */
function spectraAgree(tol) {
  return (a, b) => {
    if (a.length !== b.length) return false;
    let scale = 0;
    for (const z of a) scale = Math.max(scale, Math.abs(z.re), Math.abs(z.im));
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i].re - b[i].re) > tol * scale) return false;
      if (Math.abs(a[i].im - b[i].im) > tol * scale) return false;
    }
    return true;
  };
}

export const cases = [
  {
    // The repro of #901: a million sequential values.
    name: 'median Float64Array 1..1,000,000 (#901)',
    kind: 'gain',
    pr: 'WS-R',
    make: (F) => {
      const a = Float64Array.from({ length: 1_000_000 }, (_, i) => i + 1);
      return () => F.median(a);
    },
  },
  {
    name: 'median Float64Array random n = 1,000,000',
    kind: 'gain',
    pr: 'WS-R',
    make: (F) => {
      const a = floats(1_000_000, 0x901a01);
      return () => F.median(a);
    },
  },
  {
    name: 'median number[] random n = 1,000,000',
    kind: 'gain',
    pr: 'WS-R',
    make: (F) => {
      const a = Array.from(floats(1_000_000, 0x901a02));
      return () => F.median(a);
    },
  },
  {
    name: 'median number[] random n = 10,000 (even)',
    kind: 'gain',
    pr: 'WS-R',
    make: (F) => {
      const a = Array.from(floats(10_000, 0x901a03));
      return () => F.median(a);
    },
  },
  {
    // Unchanged code on both sides: the spread of this row is the noise of the run.
    name: 'sort number[] n = 100,000 (unchanged path)',
    kind: 'neutral',
    pr: 'WS-R',
    make: (F) => {
      const a = Array.from(floats(100_000, 0x901b01));
      return () => F.sort(a.slice());
    },
  },
  {
    // The repro of #933: a power of two, the case where main already used the typed kernel.
    name: 'fft number[] n = 65,536 (#933)',
    kind: 'gain',
    pr: 'WS-R',
    make: (F) => {
      const a = Array.from(floats(65_536, 0x933a01));
      return () => F.fft(a);
    },
  },
  {
    name: 'fft Float64Array n = 65,536',
    kind: 'neutral',
    pr: 'WS-R',
    make: (F) => {
      const a = floats(65_536, 0x933a02);
      return () => F.fft(a);
    },
  },
  {
    name: 'fft number[] n = 4,096',
    kind: 'neutral',
    pr: 'WS-R',
    make: (F) => {
      const a = Array.from(floats(4_096, 0x933a03));
      return () => F.fft(a);
    },
  },
  {
    // A length that is not a power of two: main runs the recursive path, head the flat kernel
    // (Bluestein). The values agree to rounding, not bit for bit.
    name: 'fft number[] n = 1,000',
    kind: 'gain',
    pr: 'WS-R',
    compare: spectraAgree(1e-9),
    make: (F) => {
      const a = Array.from(floats(1_000, 0x933a04));
      return () => F.fft(a);
    },
  },
  {
    name: 'fft number[] n = 63 (below the flat kernel)',
    kind: 'neutral',
    pr: 'WS-R',
    make: (F) => {
      const a = Array.from(floats(63, 0x933a05));
      return () => F.fft(a);
    },
  },
];
