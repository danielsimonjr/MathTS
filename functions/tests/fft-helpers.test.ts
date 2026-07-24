import { describe, it, expect } from 'vitest';
import { rfft, irfft, fftshift, ifftshift, fftfreq, rfftfreq, fftn } from '../src/index.js';

describe('FFT helpers', () => {
  it('rfft([1,2,3,4]) = [10, -2+2i, -2]', () => {
    const s = rfft([1, 2, 3, 4]);
    expect(s.re.map((v) => Math.round(v))).toEqual([10, -2, -2]);
    expect(s.im.map((v) => Math.round(v))).toEqual([0, 2, 0]);
  });
  it('irfft(rfft(x)) round-trips', () => {
    const x = [1, 2, 3, 4, 5, 6];
    const back = irfft(rfft(x), x.length);
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });
  it('irfft(rfft(x)) round-trips for odd length', () => {
    const x = [1, 2, 3, 4, 5];
    const back = irfft(rfft(x), x.length);
    x.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 8));
  });
  it('fftfreq(4) = [0,0.25,-0.5,-0.25]', () => {
    expect(fftfreq(4)).toEqual([0, 0.25, -0.5, -0.25]);
  });
  it('rfftfreq(4) = [0,0.25,0.5]', () => {
    expect(rfftfreq(4)).toEqual([0, 0.25, 0.5]);
  });
  it('fftshift([0,1,2,3]) = [2,3,0,1] and ifftshift undoes it', () => {
    expect(fftshift([0, 1, 2, 3])).toEqual([2, 3, 0, 1]);
    expect(ifftshift(fftshift([0, 1, 2, 3, 4]))).toEqual([0, 1, 2, 3, 4]);
  });
  it('fftn([[1,2],[3,4]]) matches the row-then-column 2D FFT', () => {
    const s = fftn([
      [1, 2],
      [3, 4],
    ]);
    expect(s.re.map((row) => row.map((v) => Math.round(v)))).toEqual([
      [10, -2],
      [-4, 0],
    ]);
    expect(s.im.map((row) => row.map((v) => Math.round(v)))).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
