import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_THRESHOLD_BY_OP,
  ThresholdDispatcher,
} from '../../src/index.js';

/**
 * GC14 — threshold consolidation guard. ComputePool's per-op
 * DEFAULT_THRESHOLD_BY_OP (benchmark-tuned, the authority the typed functions
 * dispatch through) is the single source of truth. The coarser category-level
 * ThresholdDispatcher derives its overlapping matmul threshold from it, so the
 * two cannot silently diverge (they did before: 10000 vs 4096).
 */
describe('GC14: threshold mechanisms agree on the overlapping op', () => {
  it('ThresholdDispatcher.matmul is sourced from the canonical per-op matmul', () => {
    expect(DEFAULT_THRESHOLDS.matmul).toBe(DEFAULT_THRESHOLD_BY_OP.matmul);
  });

  it('the canonical matmul threshold is the benchmark-tuned value', () => {
    expect(DEFAULT_THRESHOLD_BY_OP.matmul).toBe(4096);
  });

  it('ThresholdDispatcher.getThreshold(matmul) returns the canonical value', () => {
    const d = new ThresholdDispatcher();
    expect(d.getThreshold('matmul')).toBe(DEFAULT_THRESHOLD_BY_OP.matmul);
  });
});
