/**
 * Dogfood #1240 (cause A) - `eig` keeps a complex pair beside an entry of 1e16 or more.
 *
 * The hqr2 deflation test compares a subdiagonal entry with `eps * s`, where `s` is the sum of the
 * two diagonal entries beside it. When both are zero, `s` was replaced by the norm of the whole
 * matrix. For [[s,0,0],[0,0,1],[0,-1,0]] the coupling 1 is at most `eps * s` for s >= 1e16, so the
 * pair +-i split into two real zeros. The LAPACK dlahqr rule uses the neighbouring subdiagonal
 * entries instead, which are the local scale of the block.
 */

import { describe, it, expect } from 'vitest';
import { eig, eigvals } from '../src/index.js';

type Value = { re: number; im: number };

const sorted = (vs: Value[]): Value[] => [...vs].sort((a, b) => a.re - b.re || a.im - b.im);

describe('eig keeps a complex pair beside a huge entry (#1240 cause A)', () => {
  for (const s of [1e15, 1e16, 1e20, 1e200]) {
    it(`[[${s},0,0],[0,0,1],[0,-1,0]] has the values ${s} and +-i`, () => {
      const A = [
        [s, 0, 0],
        [0, 0, 1],
        [0, -1, 0],
      ];
      const [first, second, third] = sorted(eigvals(A));
      // sorted by real part, then imaginary part: -i and +i (re 0), then the huge value
      expect(first.re).toBeCloseTo(0, 15);
      expect(first.im).toBeCloseTo(-1, 15);
      expect(second.re).toBeCloseTo(0, 15);
      expect(second.im).toBeCloseTo(1, 15);
      expect(third.re / s).toBeCloseTo(1, 15);
      expect(third.im).toBe(0);
    });
  }

  it('the same holds for the full decomposition at 1e16', () => {
    const r = eig([
      [1e16, 0, 0],
      [0, 0, 1],
      [0, -1, 0],
    ]);
    const imag = r.values.filter((v) => v.im !== 0);
    expect(imag).toHaveLength(2);
    expect(Math.abs(imag[0].im)).toBeCloseTo(1, 15);
    expect(imag[0].im + imag[1].im).toBe(0);
  });

  it('[[0,1],[-1,0]] stays +-i', () => {
    const [a, b] = sorted(
      eigvals([
        [0, 1],
        [-1, 0],
      ])
    );
    expect(a.re).toBeCloseTo(0, 15);
    expect(a.im).toBeCloseTo(-1, 15);
    expect(b.re).toBeCloseTo(0, 15);
    expect(b.im).toBeCloseTo(1, 15);
  });

  it('the zero matrix stays real zero', () => {
    const vs = eigvals([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(vs).toHaveLength(3);
    for (const v of vs) {
      expect(v.re).toBe(0);
      expect(v.im).toBe(0);
    }
  });
});
