/**
 * Extended Signal Processing Tests
 *
 * Tests for crossCorrelation, autoCorrelation, groupDelay, and unwrapPhase.
 */

import { describe, it, expect } from 'vitest';
import { crossCorrelation, autoCorrelation, groupDelay, unwrapPhase } from '../src/typed/signal.js';

const EPSILON = 1e-10;

function expectClose(actual: number, expected: number, tol = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// =============================================================================
// crossCorrelation
// =============================================================================

describe('crossCorrelation', () => {
  it('should compute cross-correlation of identical signals', () => {
    const a = [1, 2, 3];
    const result = crossCorrelation(a, a);
    expect(result.length).toBe(5); // 3 + 3 - 1

    // Zero-lag is at index nb-1 = 2, which is sum of squares
    expectClose(result[2], 1 * 1 + 2 * 2 + 3 * 3); // 14
  });

  it('should compute cross-correlation of different signals', () => {
    const a = [1, 0, 0];
    const b = [0, 0, 1];
    const result = crossCorrelation(a, b);
    expect(result.length).toBe(5);
    // Zero-lag at index 2: sum_j a[j]*b[j] = 0
    expectClose(result[2], 0);
    // At index 4 (lag=+2): a[2]*b[0] = 0, but a[j]*b[j-2]: j=2 -> b[0]=0.
    // At index 0 (lag=-2): a[j]*b[j+2]: j=0 -> a[0]*b[2]=1
    expectClose(result[0], 1);
  });

  it('should return empty for empty input', () => {
    expect(crossCorrelation([], [1, 2])).toEqual([]);
    expect(crossCorrelation([1, 2], [])).toEqual([]);
  });

  it('should handle single-element arrays', () => {
    const result = crossCorrelation([3], [4]);
    expect(result.length).toBe(1);
    expectClose(result[0], 12);
  });
});

// =============================================================================
// autoCorrelation
// =============================================================================

describe('autoCorrelation', () => {
  it('should be symmetric', () => {
    const a = [1, 2, 3, 4];
    const result = autoCorrelation(a);
    const n = result.length; // 2*4-1 = 7
    // Auto-correlation is symmetric around center (index n-1 = 3)
    const center = a.length - 1;
    for (let i = 0; i < center; i++) {
      expectClose(result[center - i], result[center + i]);
    }
  });

  it('should peak at zero lag', () => {
    const a = [1, 2, 3];
    const result = autoCorrelation(a);
    // Zero-lag is at index nb-1 = 2
    const zeroLag = a.length - 1;
    for (let i = 0; i < result.length; i++) {
      expect(result[zeroLag]).toBeGreaterThanOrEqual(result[i] - EPSILON);
    }
  });
});

// =============================================================================
// groupDelay
// =============================================================================

describe('groupDelay', () => {
  it('should compute group delay of a pure delay filter', () => {
    // A pure delay of 2 samples: b = [0, 0, 1], a = [1]
    // Group delay should be 2 at all frequencies
    const { delay } = groupDelay([0, 0, 1], [1]);
    for (const d of delay) {
      expectClose(d, 2, 0.01);
    }
  });

  it('should compute group delay of FIR filter', () => {
    // Symmetric FIR filter [1, 2, 1] has constant group delay of 1
    // except at frequencies where B(e^jw) = 0 (at w=pi: 1-2+1=0)
    const { w, delay } = groupDelay([1, 2, 1], [1]);
    expect(w.length).toBe(512);
    // For linear phase FIR, group delay is (N-1)/2 = 1
    // Skip frequencies near the zero at w=pi
    for (let i = 0; i < delay.length; i++) {
      if (Math.abs(w[i] - Math.PI) > 0.02) {
        expectClose(delay[i], 1, 0.05);
      }
    }
  });

  it('should accept custom frequency array', () => {
    const w = [0, Math.PI / 4, Math.PI / 2, Math.PI];
    const result = groupDelay([0, 0, 1], [1], w);
    expect(result.w.length).toBe(4);
    expect(result.delay.length).toBe(4);
  });
});

// =============================================================================
// unwrapPhase
// =============================================================================

describe('unwrapPhase', () => {
  it('should unwrap a phase ramp that wraps', () => {
    // Phase: 0, 1, 2, 3, 4-2pi, 5-2pi, 6-2pi
    const wrapped = [0, 1, 2, 3, 4 - 2 * Math.PI, 5 - 2 * Math.PI, 6 - 2 * Math.PI];
    const result = unwrapPhase(wrapped);
    for (let i = 0; i < result.length; i++) {
      expectClose(result[i], i, 1e-10);
    }
  });

  it('should not modify already continuous phase', () => {
    const phase = [0, 0.1, 0.2, 0.3, 0.4];
    const result = unwrapPhase(phase);
    for (let i = 0; i < phase.length; i++) {
      expectClose(result[i], phase[i]);
    }
  });

  it('should handle empty input', () => {
    expect(unwrapPhase([])).toEqual([]);
  });

  it('should handle single element', () => {
    const result = unwrapPhase([1.5]);
    expect(result.length).toBe(1);
    expectClose(result[0], 1.5);
  });

  it('should unwrap negative wraps', () => {
    // Phase decreasing then wrapping up
    const phase = [0, -1, -2, -3, -4 + 2 * Math.PI, -5 + 2 * Math.PI];
    const result = unwrapPhase(phase);
    for (let i = 0; i < result.length; i++) {
      expectClose(result[i], -i, 1e-10);
    }
  });
});
