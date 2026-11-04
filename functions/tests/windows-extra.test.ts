import { describe, it, expect } from 'vitest';
import {
  kaiserWindow,
  gaussianWindow,
  tukeyWindow,
  blackmanHarrisWindow,
  flattopWindow,
  parzenWindow,
  exponentialWindow,
  getWindow,
} from '../src/signal/windows-extra.js';
import { windowFunction } from '../src/typed/signal.js';

describe('extra windows', () => {
  it('tukey(alpha=0) is rectangular and tukey(alpha=1) is hann', () => {
    expect(tukeyWindow(8, 0)).toEqual(new Array(8).fill(1));
    const t = tukeyWindow(9, 1);
    const h = windowFunction(9, 'hann');
    t.forEach((v, i) => expect(v).toBeCloseTo(h[i], 12));
  });

  it('kaiser beta=0 is rectangular', () => {
    expect(kaiserWindow(5, 0)).toEqual([1, 1, 1, 1, 1]);
  });

  it('blackman-harris and flattop peak at the centre', () => {
    expect(blackmanHarrisWindow(9)[4]).toBeCloseTo(1, 12);
    // scipy's flattop coefficients sum to 1.000000003 at the centre
    expect(flattopWindow(9)[4]).toBeCloseTo(1, 8);
  });

  it('gaussian window values', () => {
    const g = gaussianWindow(7, 1);
    expect(g[3]).toBeCloseTo(1, 12);
    expect(g[2]).toBeCloseTo(0.6065306597126334, 12);
  });

  it('parzen peak and exponential centre', () => {
    expect(parzenWindow(5)[2]).toBeCloseTo(1, 12);
    expect(exponentialWindow(5, 2)[2]).toBeCloseTo(1, 12);
  });

  it('periodic variant drops the last sample of the length n+1 window', () => {
    const p = gaussianWindow(4, 1, { sym: false });
    expect(p).toHaveLength(4);
    expect(p[0]).toBeCloseTo(Math.exp(-2), 12);
  });

  it('getWindow delegates classic names and handles params', () => {
    expect(getWindow('hann', 9)).toEqual(windowFunction(9, 'hann'));
    expect(getWindow('kaiser', 5, 0)).toEqual([1, 1, 1, 1, 1]);
    expect(getWindow('tukey', 8, 0)).toEqual(new Array(8).fill(1));
  });
});
