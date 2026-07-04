import { describe, it, expect } from 'vitest';
import {
  fft,
  ifft,
  resample,
  kdTree,
  voronoiDiagram,
  spectralClustering,
} from '@danielsimonjr/mathts-functions';
import { Complex } from '@danielsimonjr/mathts-core';

/**
 * WS-1 P2 — oracle pins for the signal/geometry functions the matrix listed as
 * SELF-REF (previously only round-trip / shape checks). These use KNOWN DFTs and
 * known geometric structure — the FFT pins are NOT `fft`→`ifft` round-trips: each
 * spectrum is written out by hand and matched independently. Two robustness bugs
 * were fixed while writing these (`voronoiDiagram` missing-bounds crash, and a real
 * `spectralClustering` infinite loop on a non-square input).
 * See [[feedback-oracle-tests-implementation-independent]].
 */

const re = (c: { re: number }) => c.re;

describe('fft / ifft — known DFTs (not round-trips)', () => {
  it('DFT[1,1,1,1] = [4,0,0,0] (only the DC bin)', () => {
    const F = fft([1, 1, 1, 1]);
    expect(F.map(re).map((x) => Math.round(x * 1e9) / 1e9)).toEqual([4, 0, 0, 0]);
  });
  it('DFT[1,−1,1,−1] = [0,0,4,0] (energy at the Nyquist bin)', () => {
    const F = fft([1, -1, 1, -1]);
    expect(F.map(re).map((x) => Math.round(x * 1e9) / 1e9)).toEqual([0, 0, 4, 0]);
  });
  it('IDFT of the hand-written spectrum [4,0,0,0] = [1,1,1,1]', () => {
    const sig = ifft([new Complex(4, 0), new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)]);
    expect(sig.map((c) => Math.round(c.re * 1e9) / 1e9)).toEqual([1, 1, 1, 1]);
  });
});

describe('resample — integer decimation', () => {
  it('resample([1,2,3,4], 1, 2) downsamples by 2 → [1,3]', () => {
    expect(resample([1, 2, 3, 4], 1, 2)).toEqual([1, 3]);
  });
});

describe('kdTree — median split', () => {
  it('root of {(2,3),(5,4),(9,6),(4,7)} is the x-median (5,4)', () => {
    expect(
      kdTree([
        [2, 3],
        [5, 4],
        [9, 6],
        [4, 7],
      ])?.point
    ).toEqual([5, 4]);
  });
});

describe('voronoiDiagram — structure + guard', () => {
  it('each of the 3 sites gets a region', () => {
    const v = voronoiDiagram(
      [
        [1, 1],
        [9, 1],
        [5, 9],
      ],
      [0, 0, 10, 10]
    );
    expect(v.regions.length).toBe(3);
  });
  it('throws a clear error when bounds are missing/malformed', () => {
    expect(() =>
      voronoiDiagram([[1, 1]], undefined as unknown as [number, number, number, number])
    ).toThrow(/bounds must be/);
  });
});

describe('spectralClustering — separates graph components + guard', () => {
  it('block-diagonal adjacency {0,1}|{2,3} → two clusters', () => {
    const labels = spectralClustering(
      [
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0],
      ],
      2
    );
    expect(labels[0]).toBe(labels[1]);
    expect(labels[2]).toBe(labels[3]);
    expect(labels[0]).not.toBe(labels[2]);
  });
  it('rejects a non-square adjacency (was an infinite loop) with a clear error', () => {
    expect(() =>
      spectralClustering(
        [
          [0, 0],
          [0.1, 0.1],
          [10, 10],
        ],
        2
      )
    ).toThrow(/square/);
  });
});
