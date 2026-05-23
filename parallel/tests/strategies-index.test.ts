/**
 * Smoke test for parallel/src/strategies/index.ts (strategies barrel)
 *
 * Asserts that a representative sample of chunking and threshold strategy
 * exports exist on the imported namespace.
 */
import { describe, it, expect } from 'vitest';
import * as strat from '../src/strategies/index.js';

describe('parallel/src/strategies/index.ts – barrel smoke test', () => {
  it('exports chunking helpers as functions', () => {
    expect(typeof strat.calculateOptimalChunks).toBe('function');
    expect(typeof strat.chunkFloat64Array).toBe('function');
    expect(typeof strat.chunkArray).toBe('function');
    expect(typeof strat.mergeFloat64Chunks).toBe('function');
    expect(typeof strat.mergeArrayChunks).toBe('function');
  });

  it('exports partition helpers as functions', () => {
    expect(typeof strat.partitionRange).toBe('function');
    expect(typeof strat.partition2D).toBe('function');
  });

  it('exports threshold dispatcher and helpers', () => {
    expect(typeof strat.ThresholdDispatcher).toBe('function');
    expect(typeof strat.thresholdDispatcher).toBe('object');
    expect(typeof strat.shouldParallelize).toBe('function');
    expect(typeof strat.dispatch).toBe('function');
    expect(typeof strat.calculateChunks).toBe('function');
  });

  it('exports DEFAULT_THRESHOLDS constant', () => {
    expect(strat.DEFAULT_THRESHOLDS).toBeDefined();
    expect(typeof strat.DEFAULT_THRESHOLDS).toBe('object');
  });
});
