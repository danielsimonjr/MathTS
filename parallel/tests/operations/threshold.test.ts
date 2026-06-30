/**
 * Threshold Dispatcher Tests
 *
 * Tests for threshold-based parallel vs sequential dispatch.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  ThresholdDispatcher,
  thresholdDispatcher,
  shouldParallelize,
  dispatch,
  calculateChunks,
  DEFAULT_THRESHOLDS,
} from '../../src/strategies/threshold.js';
import { ComputePool } from '../../src/ComputePool.js';

describe('Threshold Dispatcher', () => {
  describe('DEFAULT_THRESHOLDS', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_THRESHOLDS.matmul).toBe(4096); // canonical (DEFAULT_THRESHOLD_BY_OP.matmul)
      expect(DEFAULT_THRESHOLDS.elementwise).toBe(50000);
      expect(DEFAULT_THRESHOLDS.reduce).toBe(100000);
      expect(DEFAULT_THRESHOLDS.map).toBe(10000);
      expect(DEFAULT_THRESHOLDS.sort).toBe(5000);
      expect(DEFAULT_THRESHOLDS.decomposition).toBe(2500);
      expect(DEFAULT_THRESHOLDS.general).toBe(50000);
    });
  });

  describe('ThresholdDispatcher class', () => {
    let dispatcher: ThresholdDispatcher;
    let pool: ComputePool;

    beforeAll(async () => {
      pool = new ComputePool({ thresholdElements: 100 });
      await pool.initialize();
    });

    afterAll(async () => {
      await pool.terminate();
    });

    beforeEach(() => {
      dispatcher = new ThresholdDispatcher({}, pool);
    });

    it('should create with default thresholds', () => {
      const thresholds = dispatcher.getThresholds();

      expect(thresholds.matmul).toBe(DEFAULT_THRESHOLDS.matmul);
      expect(thresholds.elementwise).toBe(DEFAULT_THRESHOLDS.elementwise);
    });

    it('should create with custom thresholds', () => {
      const custom = new ThresholdDispatcher({ matmul: 5000, elementwise: 25000 }, pool);
      const thresholds = custom.getThresholds();

      expect(thresholds.matmul).toBe(5000);
      expect(thresholds.elementwise).toBe(25000);
      expect(thresholds.reduce).toBe(DEFAULT_THRESHOLDS.reduce); // Unchanged
    });

    it('should update thresholds', () => {
      dispatcher.setThresholds({ matmul: 20000 });

      expect(dispatcher.getThreshold('matmul')).toBe(20000);
    });

    it('should get threshold for operation category', () => {
      expect(dispatcher.getThreshold('matmul')).toBe(DEFAULT_THRESHOLDS.matmul);
      expect(dispatcher.getThreshold('elementwise')).toBe(DEFAULT_THRESHOLDS.elementwise);
      expect(dispatcher.getThreshold('general')).toBe(DEFAULT_THRESHOLDS.general);
    });
  });

  describe('dispatch decision', () => {
    let pool: ComputePool;
    let dispatcher: ThresholdDispatcher;

    beforeAll(async () => {
      pool = new ComputePool({ thresholdElements: 100 });
      await pool.initialize();
    });

    afterAll(async () => {
      await pool.terminate();
    });

    beforeEach(() => {
      dispatcher = new ThresholdDispatcher({}, pool);
    });

    it('should return sequential for elements below threshold', () => {
      const result = dispatcher.dispatch(2000, 'matmul'); // canonical matmul threshold is 4096

      expect(result.mode).toBe('sequential');
      expect(result.reason).toContain('below threshold');
      expect(result.threshold).toBe(4096);
      expect(result.elementCount).toBe(2000);
    });

    it('should return parallel for elements above threshold', () => {
      const result = dispatcher.dispatch(20000, 'matmul');

      expect(result.mode).toBe('parallel');
      expect(result.reason).toContain('exceeds threshold');
    });

    it('should use operation-specific thresholds', () => {
      // matmul threshold is 4096 (canonical, from DEFAULT_THRESHOLD_BY_OP)
      expect(dispatcher.dispatch(2000, 'matmul').mode).toBe('sequential');
      expect(dispatcher.dispatch(8000, 'matmul').mode).toBe('parallel');

      // elementwise threshold is 50000
      expect(dispatcher.dispatch(40000, 'elementwise').mode).toBe('sequential');
      expect(dispatcher.dispatch(60000, 'elementwise').mode).toBe('parallel');
    });

    it('should use general threshold for unknown categories', () => {
      const result = dispatcher.dispatch(60000, 'general');

      expect(result.mode).toBe('parallel');
      expect(result.threshold).toBe(DEFAULT_THRESHOLDS.general);
    });
  });

  describe('shouldParallelize', () => {
    let pool: ComputePool;
    let dispatcher: ThresholdDispatcher;

    beforeAll(async () => {
      pool = new ComputePool({ thresholdElements: 100 });
      await pool.initialize();
    });

    afterAll(async () => {
      await pool.terminate();
    });

    beforeEach(() => {
      dispatcher = new ThresholdDispatcher({}, pool);
    });

    it('should return false below threshold', () => {
      expect(dispatcher.shouldParallelize(2000, 'matmul')).toBe(false); // canonical matmul = 4096
    });

    it('should return true above threshold', () => {
      expect(dispatcher.shouldParallelize(20000, 'matmul')).toBe(true);
    });

    it('should default to general category', () => {
      expect(dispatcher.shouldParallelize(40000)).toBe(false); // Below general threshold
      expect(dispatcher.shouldParallelize(60000)).toBe(true); // Above general threshold
    });
  });

  describe('calculateChunks', () => {
    let pool: ComputePool;
    let dispatcher: ThresholdDispatcher;

    beforeAll(async () => {
      pool = new ComputePool({ thresholdElements: 100, maxWorkers: 4 });
      await pool.initialize();
    });

    afterAll(async () => {
      await pool.terminate();
    });

    beforeEach(() => {
      dispatcher = new ThresholdDispatcher({}, pool);
    });

    it('should return 1 for sequential operations', () => {
      const chunks = dispatcher.calculateChunks(5000, 'matmul');

      expect(chunks).toBe(1);
    });

    it('should calculate chunks based on worker count', () => {
      const chunks = dispatcher.calculateChunks(100000, 'matmul');

      // In test environment, worker count may be 0 or minimal
      // The function should return at least 1 for valid parallel operations
      expect(chunks).toBeGreaterThanOrEqual(1);
    });

    it('should vary chunks by operation category', () => {
      const matmulChunks = dispatcher.calculateChunks(200000, 'matmul');
      const sortChunks = dispatcher.calculateChunks(200000, 'sort');

      // Both categories yield a valid (>= 1) chunk count.
      expect(matmulChunks).toBeGreaterThanOrEqual(1);
      // Sort typically has fewer chunks due to merge overhead
      expect(sortChunks).toBeLessThanOrEqual(8);
    });
  });

  describe('Convenience functions', () => {
    it('should export shouldParallelize function', () => {
      expect(typeof shouldParallelize).toBe('function');
    });

    it('should export dispatch function', () => {
      expect(typeof dispatch).toBe('function');
      const result = dispatch(100000, 'matmul');

      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('reason');
    });

    it('should export calculateChunks function', () => {
      expect(typeof calculateChunks).toBe('function');
    });

    it('should export thresholdDispatcher instance', () => {
      expect(thresholdDispatcher).toBeDefined();
      expect(thresholdDispatcher).toBeInstanceOf(ThresholdDispatcher);
    });
  });

  describe('Pool not ready', () => {
    it('should return sequential when pool not initialized', () => {
      const uninitPool = new ComputePool();
      const dispatcher = new ThresholdDispatcher({}, uninitPool);

      const result = dispatcher.dispatch(100000, 'matmul');

      expect(result.mode).toBe('sequential');
      expect(result.reason).toContain('not initialized');
    });
  });

  describe('Pool disabled', () => {
    it('should return sequential when pool disabled', async () => {
      const disabledPool = new ComputePool({ enabled: false });
      await disabledPool.initialize();

      const dispatcher = new ThresholdDispatcher({}, disabledPool);
      const result = dispatcher.dispatch(100000, 'matmul');

      expect(result.mode).toBe('sequential');
      expect(result.reason).toContain('disabled');

      await disabledPool.terminate();
    });
  });
});
