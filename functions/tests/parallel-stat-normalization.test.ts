/**
 * parallelStatStd and parallelStatVariance read an unknown normalization string as 'unbiased'
 * (`parallelStatStd(data, 'bogus')` was 1.5275252316519463). They now throw the TypeError of
 * `std` and `variance`.
 */
import { describe, expect, it } from 'vitest';
import { parallelStatStd, parallelStatVariance, std, variance } from '../src/index.js';

const data = new Float64Array([1, 2, 4]);
const MESSAGE =
  /Unknown normalization "bogus"\. Choose "unbiased" \(default\), "uncorrected", or "biased"\./;

describe('the parallel std and variance reject an unknown normalization', () => {
  it('std and variance throw the same TypeError (the reference)', () => {
    expect(() => std([1, 2, 4], 'bogus' as never)).toThrow(MESSAGE);
    expect(() => variance([1, 2, 4], 'bogus' as never)).toThrow(MESSAGE);
  });
  it.each([
    ['parallelStatStd of a Float64Array', () => parallelStatStd(data, 'bogus')],
    ['parallelStatStd of an Array', () => parallelStatStd([1, 2, 4], 'bogus')],
    ['parallelStatVariance of a Float64Array', () => parallelStatVariance(data, 'bogus')],
    ['parallelStatVariance of an Array', () => parallelStatVariance([1, 2, 4], 'bogus')],
  ])('%s', async (_label, call) => {
    await expect((async () => call())()).rejects.toThrow(TypeError);
    await expect((async () => call())()).rejects.toThrow(MESSAGE);
  });
  it('GUARD: the three known strings keep their values', async () => {
    for (const norm of ['unbiased', 'uncorrected', 'biased'] as const) {
      expect(await parallelStatVariance(data, norm)).toBeCloseTo(
        variance([1, 2, 4], norm) as number,
        14
      );
      expect(await parallelStatStd(data, norm)).toBeCloseTo(std([1, 2, 4], norm) as number, 14);
    }
  });
});
