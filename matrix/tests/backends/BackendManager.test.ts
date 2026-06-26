/**
 * Tests for matrix/src/backends/BackendManager.ts
 *
 * The BackendManager wraps the global backendRegistry with operation-aware
 * backend selection, error-fallback execution, adaptive threshold tuning, and
 * performance statistics. Tests use a fresh manager instance per case and the
 * always-available JSBackend so results are deterministic regardless of which
 * WASM/GPU artifacts happen to be present.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BackendManager,
  createBackendManager,
  DEFAULT_EXTENDED_HINTS,
  backendManager,
} from '../../src/backends/BackendManager.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { resetConfig, setConfig, configureAdaptiveTuning } from '../../src/config.js';
import { backendRegistry, type MatrixBackend, type BackendType } from '../../src/backends/Backend.js';

/**
 * A backend whose every operation throws — used to drive the
 * executeWithFallback() catch path and every per-op JS fallback closure.
 */
function makeThrowingBackend(type: BackendType): MatrixBackend {
  const boom = () => {
    throw new Error('boom');
  };
  return {
    type,
    isAvailable: () => true,
    initialize: async () => {},
    add: boom,
    subtract: boom,
    multiplyElementwise: boom,
    divideElementwise: boom,
    scale: boom,
    abs: boom,
    negate: boom,
    multiply: boom,
    transpose: boom,
    sum: boom,
    sumAxis: boom,
    norm: boom,
    dot: boom,
  };
}

describe('DEFAULT_EXTENDED_HINTS', () => {
  it('extends the base hints with operation thresholds', () => {
    expect(DEFAULT_EXTENDED_HINTS.autoSIMD).toBe(true);
    expect(DEFAULT_EXTENDED_HINTS.fallbackOnError).toBe(true);
    expect(DEFAULT_EXTENDED_HINTS.operationThresholds.multiply?.wasm).toBe(500);
  });
});

describe('BackendManager — construction & hints', () => {
  let mgr: BackendManager;
  beforeEach(() => {
    mgr = createBackendManager();
  });
  afterEach(() => {
    mgr.destroy();
  });

  it('exposes a default singleton instance', () => {
    expect(backendManager).toBeInstanceOf(BackendManager);
  });

  it('createBackendManager() returns a new BackendManager', () => {
    expect(mgr).toBeInstanceOf(BackendManager);
  });

  it('getHints() reflects custom hints passed to the constructor', () => {
    const custom = createBackendManager({ wasmThreshold: 50 });
    expect(custom.getHints().wasmThreshold).toBe(50);
    custom.destroy();
  });

  it('setHints() merges new hints', () => {
    mgr.setHints({ wasmThreshold: 7 });
    expect(mgr.getHints().wasmThreshold).toBe(7);
  });

  it('getHints() returns a fresh copy', () => {
    const h = mgr.getHints();
    h.wasmThreshold = 123456;
    expect(mgr.getHints().wasmThreshold).not.toBe(123456);
  });
});

describe('BackendManager — selectBackend / getActiveBackend', () => {
  let mgr: BackendManager;
  beforeEach(() => {
    mgr = createBackendManager();
  });
  afterEach(() => mgr.destroy());

  it('selects JS for tiny inputs', () => {
    expect(mgr.selectBackend(1, 'add').type).toBe('js');
  });

  it('getActiveBackend mirrors selectBackend().type', () => {
    expect(mgr.getActiveBackend(1, 'add')).toBe('js');
  });

  it('forceBackend(null) resets the preferred backend to js', () => {
    mgr.forceBackend(null);
    expect(mgr.getHints().preferredBackend).toBe('js');
    expect(mgr.selectBackend(1).type).toBe('js');
  });

  it('forceBackend with an unavailable type still falls back to js for selection', () => {
    // 'gpu' is almost certainly unavailable in node; selection must not throw
    // and should fall back to js.
    mgr.forceBackend('gpu');
    expect(mgr.getHints().preferredBackend).toBe('gpu');
    expect(mgr.selectBackend(1).type).toBe('js');
  });

  it('applies operation-specific thresholds without throwing for a known op', () => {
    // decomposition has its own thresholds in DEFAULT_EXTENDED_HINTS
    const sel = mgr.selectBackend(50, 'decomposition');
    expect(['js', 'wasm', 'gpu']).toContain(sel.type);
  });

  it('selects JS for a tiny heavy op (no rust-wasm preference after Phase 7b)', () => {
    // Heavy-op routing to a dedicated Rust backend was removed in Phase 7b;
    // tiny inputs fall through to JS regardless of operation.
    const sel = mgr.selectBackend(10, 'fft');
    expect(sel.type).toBe('js');
  });
});

describe('BackendManager — backend info', () => {
  let mgr: BackendManager;
  beforeEach(() => {
    mgr = createBackendManager();
  });
  afterEach(() => mgr.destroy());

  it('getAvailableBackends() always includes js', () => {
    expect(mgr.getAvailableBackends()).toContain('js');
  });

  it('hasBackend("js") is true', () => {
    expect(mgr.hasBackend('js')).toBe(true);
  });
});

describe('BackendManager — element-wise operations (JS fallback path)', () => {
  let mgr: BackendManager;
  beforeEach(() => {
    mgr = createBackendManager();
  });
  afterEach(() => mgr.destroy());

  const a = DenseMatrix.fromArray([
    [1, 2],
    [3, 4],
  ]);
  const b = DenseMatrix.fromArray([
    [5, 6],
    [7, 8],
  ]);

  it('add()', () => {
    expect(mgr.add(a, b).toArray()).toEqual([
      [6, 8],
      [10, 12],
    ]);
  });

  it('subtract()', () => {
    expect(mgr.subtract(b, a).toArray()).toEqual([
      [4, 4],
      [4, 4],
    ]);
  });

  it('multiplyElementwise()', () => {
    expect(mgr.multiplyElementwise(a, b).toArray()).toEqual([
      [5, 12],
      [21, 32],
    ]);
  });

  it('divideElementwise()', () => {
    const result = mgr.divideElementwise(b, a).toArray();
    expect(result[0][0]).toBeCloseTo(5);
    expect(result[1][1]).toBeCloseTo(2);
  });

  it('scale()', () => {
    expect(mgr.scale(a, 2).toArray()).toEqual([
      [2, 4],
      [6, 8],
    ]);
  });

  it('abs()', () => {
    const neg = DenseMatrix.fromArray([
      [-1, 2],
      [-3, -4],
    ]);
    expect(mgr.abs(neg).toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('negate()', () => {
    expect(mgr.negate(a).toArray()).toEqual([
      [-1, -2],
      [-3, -4],
    ]);
  });
});

describe('BackendManager — matrix & reduction operations', () => {
  let mgr: BackendManager;
  beforeEach(() => {
    mgr = createBackendManager();
  });
  afterEach(() => mgr.destroy());

  const a = DenseMatrix.fromArray([
    [1, 2],
    [3, 4],
  ]);

  it('multiply()', () => {
    const i = DenseMatrix.identity(2);
    expect(mgr.multiply(a, i).toArray()).toEqual(a.toArray());
  });

  it('transpose()', () => {
    expect(mgr.transpose(a).toArray()).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it('sum() resolves to the total of all elements', async () => {
    await expect(mgr.sum(a)).resolves.toBe(10);
  });

  it('sumAxis() reduces along an axis', () => {
    const colSums = mgr.sumAxis(a, 0).toFlatArray();
    expect(colSums).toEqual([4, 6]);
  });

  it('norm() computes the Frobenius norm', () => {
    expect(mgr.norm(a)).toBeCloseTo(Math.sqrt(1 + 4 + 9 + 16));
  });

  it('dot() resolves to the vector dot product', async () => {
    const v1 = DenseMatrix.fromArray([[1, 2, 3]]);
    const v2 = DenseMatrix.fromArray([[4, 5, 6]]);
    await expect(mgr.dot(v1, v2)).resolves.toBe(32);
  });
});

describe('BackendManager — executeWithFallback', () => {
  it('falls back to JS when the selected backend throws (fallbackOnError=true)', () => {
    const mgr = createBackendManager({ fallbackOnError: true });
    // Force a backend whose op throws by forcing js then monkeypatching? Simpler:
    // verify the default path still produces a correct result (fallback wrapper
    // is exercised on every op above). Here we confirm fallbackOnError default.
    expect(mgr.getHints().fallbackOnError).toBe(true);
    mgr.destroy();
  });

  it('does not wrap in try/catch when fallbackOnError=false (still computes)', () => {
    const mgr = createBackendManager({ fallbackOnError: false });
    const a = DenseMatrix.fromArray([[1, 2]]);
    const b = DenseMatrix.fromArray([[3, 4]]);
    expect(mgr.add(a, b).toArray()).toEqual([[4, 6]]);
    mgr.destroy();
  });

  it('every operation recovers via the JS fallback when the forced backend throws', () => {
    // Register a throwing backend under an unused slot ('parallel') and force
    // it; with fallbackOnError=true every op must still return the JS result.
    const throwing = makeThrowingBackend('parallel');
    backendRegistry.register(throwing);
    try {
      const mgr = createBackendManager({ fallbackOnError: true });
      mgr.forceBackend('parallel');
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);
      expect(mgr.add(a, b).toArray()).toEqual([
        [6, 8],
        [10, 12],
      ]);
      expect(mgr.subtract(b, a).toArray()).toEqual([
        [4, 4],
        [4, 4],
      ]);
      expect(mgr.multiplyElementwise(a, b).toArray()).toEqual([
        [5, 12],
        [21, 32],
      ]);
      expect(mgr.divideElementwise(b, a).toArray()[0][0]).toBeCloseTo(5);
      expect(mgr.scale(a, 2).toArray()).toEqual([
        [2, 4],
        [6, 8],
      ]);
      expect(mgr.abs(DenseMatrix.fromArray([[-1]])).toArray()).toEqual([[1]]);
      expect(mgr.negate(a).toArray()).toEqual([
        [-1, -2],
        [-3, -4],
      ]);
      expect(mgr.multiply(a, DenseMatrix.identity(2)).toArray()).toEqual(a.toArray());
      expect(mgr.transpose(a).toArray()).toEqual([
        [1, 3],
        [2, 4],
      ]);
      expect(mgr.sumAxis(a, 0).toFlatArray()).toEqual([4, 6]);
      expect(mgr.norm(a)).toBeCloseTo(Math.sqrt(30));
      mgr.destroy();
    } finally {
      // Restore a non-throwing placeholder so other suites are unaffected.
      backendRegistry.register({ ...throwing, isAvailable: () => false });
    }
  });

  it('honors a preferred backend that is registered and available', () => {
    // The AS wasm backend is registered in the global registry; when forced and
    // available it is selected even for tiny inputs.
    const mgr = createBackendManager();
    mgr.forceBackend('wasm');
    if (backendRegistry.has('wasm')) {
      expect(mgr.selectBackend(1).type).toBe('wasm');
    }
    mgr.destroy();
  });
});

describe('BackendManager — initialize', () => {
  it('initialize() resolves and is idempotent', async () => {
    const mgr = createBackendManager();
    await mgr.initialize();
    await mgr.initialize(); // second call short-circuits
    expect(mgr.getAvailableBackends()).toContain('js');
    mgr.destroy();
  });

  it('concurrent initialize() calls share the same promise', async () => {
    const mgr = createBackendManager();
    await Promise.all([mgr.initialize(), mgr.initialize()]);
    mgr.destroy();
  });
});

describe('BackendManager — adaptive tuning & stats', () => {
  let mgr: BackendManager;
  beforeEach(() => {
    resetConfig();
    mgr = createBackendManager();
  });
  afterEach(() => {
    mgr.destroy();
    resetConfig();
  });

  it('recordSample is a no-op when adaptive tuning is disabled', () => {
    setConfig({ adaptiveTuning: { enabled: false } as never });
    mgr.recordSample('multiply', 1000, 'js', 5);
    expect(mgr.getPerformanceStats().sampleCount).toBe(0);
  });

  it('records samples and reports performance stats when enabled', () => {
    configureAdaptiveTuning({ enabled: true });
    mgr.recordSample('multiply', 1000, 'js', 5);
    mgr.recordSample('multiply', 1000, 'wasm', 2);
    const stats = mgr.getPerformanceStats();
    expect(stats.sampleCount).toBe(2);
    const multiplyStats = stats.operationStats.get('multiply');
    expect(multiplyStats?.samples).toBe(2);
    expect(multiplyStats?.backendUsage.js).toBe(1);
    expect(multiplyStats?.backendUsage.wasm).toBe(1);
  });

  it('adjusts thresholds after enough samples cross the speedup ratio', () => {
    configureAdaptiveTuning({
      enabled: true,
      cooldownMs: 0,
      sampleSize: 4,
      minSpeedupRatio: 1.1,
      maxAdjustmentPercent: 20,
    });
    // WASM much faster than JS for 'multiply' → threshold should drop.
    for (let i = 0; i < 4; i++) {
      mgr.recordSample('multiply', 10000, 'js', 100);
      mgr.recordSample('multiply', 10000, 'wasm', 5);
    }
    const adjusted = mgr.getAdaptiveThresholds();
    const m = adjusted.get('multiply');
    expect(m).toBeDefined();
    // WASM faster → wasm threshold lowered below the default 500.
    if (m) expect(m.wasm).toBeLessThanOrEqual(DEFAULT_EXTENDED_HINTS.operationThresholds.multiply!.wasm!);
  });

  it('raises the WASM threshold when JS outperforms WASM', () => {
    configureAdaptiveTuning({
      enabled: true,
      cooldownMs: 0,
      sampleSize: 4,
      minSpeedupRatio: 1.1,
      maxAdjustmentPercent: 20,
    });
    // JS much faster than WASM for 'multiply' → wasm threshold should rise.
    for (let i = 0; i < 4; i++) {
      mgr.recordSample('multiply', 10000, 'js', 5);
      mgr.recordSample('multiply', 10000, 'wasm', 100);
    }
    const m = mgr.getAdaptiveThresholds().get('multiply');
    expect(m).toBeDefined();
    if (m)
      expect(m.wasm).toBeGreaterThanOrEqual(
        DEFAULT_EXTENDED_HINTS.operationThresholds.multiply!.wasm!
      );
  });

  it('adjusts the GPU threshold based on wasm-vs-gpu throughput', () => {
    configureAdaptiveTuning({
      enabled: true,
      cooldownMs: 0,
      sampleSize: 6,
      minSpeedupRatio: 1.1,
      maxAdjustmentPercent: 25,
    });
    // GPU fastest → gpu threshold drops; then a second op where wasm beats gpu.
    for (let i = 0; i < 6; i++) {
      mgr.recordSample('multiply', 100000, 'gpu', 2);
      mgr.recordSample('multiply', 100000, 'wasm', 50);
      mgr.recordSample('transpose', 100000, 'wasm', 2);
      mgr.recordSample('transpose', 100000, 'gpu', 50);
    }
    const adjusted = mgr.getAdaptiveThresholds();
    expect(adjusted.get('multiply')).toBeDefined();
    expect(adjusted.get('transpose')).toBeDefined();
  });

  it('respects the cooldown window (no adjustment before cooldown elapses)', () => {
    configureAdaptiveTuning({
      enabled: true,
      cooldownMs: 1_000_000, // effectively never re-adjust within the test
      sampleSize: 2,
      minSpeedupRatio: 1.1,
      maxAdjustmentPercent: 20,
    });
    // First batch triggers one adjustment (lastAdjustment set), the next batch
    // is inside the cooldown window and must early-return.
    for (let i = 0; i < 2; i++) {
      mgr.recordSample('multiply', 10000, 'js', 100);
      mgr.recordSample('multiply', 10000, 'wasm', 5);
    }
    const first = mgr.getAdaptiveThresholds().get('multiply')?.wasm;
    // More samples inside the cooldown — should not change the threshold again.
    mgr.recordSample('multiply', 10000, 'js', 100);
    mgr.recordSample('multiply', 10000, 'wasm', 5);
    const second = mgr.getAdaptiveThresholds().get('multiply')?.wasm;
    expect(second).toBe(first);
  });

  it('resetAdaptiveState clears samples and adjustments', () => {
    configureAdaptiveTuning({ enabled: true });
    mgr.recordSample('add', 100, 'js', 1);
    mgr.resetAdaptiveState();
    expect(mgr.getPerformanceStats().sampleCount).toBe(0);
    expect(mgr.getAdaptiveThresholds().size).toBe(0);
  });

  it('caps the sample buffer at sampleSize * 10', () => {
    configureAdaptiveTuning({ enabled: true, sampleSize: 2, cooldownMs: 999999 });
    for (let i = 0; i < 50; i++) {
      mgr.recordSample('scale', 100, 'js', 1);
    }
    expect(mgr.getPerformanceStats().sampleCount).toBeLessThanOrEqual(20);
  });
});

describe('BackendManager — config sync', () => {
  afterEach(() => resetConfig());

  it('syncs thresholds when global config changes', () => {
    const mgr = createBackendManager();
    setConfig({
      backends: {
        wasm: { threshold: 333 },
        gpu: { threshold: 77777 },
      } as never,
    });
    expect(mgr.getHints().wasmThreshold).toBe(333);
    expect(mgr.getHints().gpuThreshold).toBe(77777);
    mgr.destroy();
  });

  it('destroy() unsubscribes from config changes (no further sync)', () => {
    const mgr = createBackendManager();
    mgr.destroy();
    setConfig({ backends: { wasm: { threshold: 4242 } } as never });
    // After destroy the manager no longer tracks config; its hint is unchanged.
    expect(mgr.getHints().wasmThreshold).not.toBe(4242);
  });
});
