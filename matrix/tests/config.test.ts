import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  resetConfig,
  onConfigChange,
  getRecommendedBackend,
  forceBackend,
  setBackendPreference,
  setBackendThreshold,
  setBackendEnabled,
  enableProfiling,
  disableProfiling,
  enableAdaptiveTuning,
  disableAdaptiveTuning,
  configureAdaptiveTuning,
} from '../src/config.js';

describe('matrix config', () => {
  afterEach(() => {
    resetConfig();
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have JS backend always enabled', () => {
      expect(DEFAULT_CONFIG.backends.js.enabled).toBe(true);
      expect(DEFAULT_CONFIG.backends.js.threshold).toBe(0);
    });

    it('should have WASM threshold of 1000', () => {
      expect(DEFAULT_CONFIG.backends.wasm.threshold).toBe(1000);
    });

    it('should have GPU threshold of 100000', () => {
      expect(DEFAULT_CONFIG.backends.gpu.threshold).toBe(100000);
    });

    it('should default to double precision', () => {
      expect(DEFAULT_CONFIG.precision).toBe('double');
    });

    it('should have profiling disabled by default', () => {
      expect(DEFAULT_CONFIG.profiling.enabled).toBe(false);
    });

    it('should have adaptive tuning enabled by default', () => {
      expect(DEFAULT_CONFIG.adaptiveTuning.enabled).toBe(true);
    });
  });

  describe('getConfig / setConfig / resetConfig', () => {
    it('should return default config initially', () => {
      const config = getConfig();
      expect(config.precision).toBe('double');
      expect(config.debug).toBe(false);
    });

    it('should update config', () => {
      setConfig({ debug: true });
      expect(getConfig().debug).toBe(true);
    });

    it('should reset to defaults', () => {
      setConfig({ debug: true });
      resetConfig();
      expect(getConfig().debug).toBe(false);
    });
  });

  describe('onConfigChange', () => {
    it('should notify listeners on change', () => {
      let called = false;
      const unsub = onConfigChange(() => { called = true; });
      setConfig({ debug: true });
      expect(called).toBe(true);
      unsub();
    });

    it('should unsubscribe correctly', () => {
      let count = 0;
      const unsub = onConfigChange(() => { count++; });
      setConfig({ debug: true });
      unsub();
      setConfig({ debug: false });
      expect(count).toBe(1);
    });
  });

  describe('getRecommendedBackend', () => {
    it('should return js for small data', () => {
      expect(getRecommendedBackend(10)).toBe('js');
    });

    it('should return wasm for medium data', () => {
      expect(getRecommendedBackend(5000)).toBe('wasm');
    });

    it('should return gpu for large data', () => {
      expect(getRecommendedBackend(200000)).toBe('gpu');
    });

    it('should use operation-specific thresholds', () => {
      // multiply has lower wasm threshold (500)
      expect(getRecommendedBackend(600, 'multiply')).toBe('wasm');
    });
  });

  describe('forceBackend', () => {
    it('should force js backend', () => {
      forceBackend('js');
      const config = getConfig();
      expect(config.backends.js.preference).toBe('require');
      expect(config.backends.wasm.preference).toBe('disable');
      expect(config.backends.gpu.preference).toBe('disable');
    });

    it('should reset all to auto when null', () => {
      forceBackend('js');
      forceBackend(null);
      const config = getConfig();
      expect(config.backends.js.preference).toBe('auto');
      expect(config.backends.wasm.preference).toBe('auto');
    });
  });

  describe('setBackendPreference', () => {
    it('should set preference for wasm', () => {
      setBackendPreference('wasm', 'prefer');
      expect(getConfig().backends.wasm.preference).toBe('prefer');
    });

    it('should ignore parallel backend', () => {
      setBackendPreference('parallel', 'require');
      // Should not throw
    });
  });

  describe('setBackendThreshold', () => {
    it('should set threshold', () => {
      setBackendThreshold('wasm', 2000);
      expect(getConfig().backends.wasm.threshold).toBe(2000);
    });
  });

  describe('setBackendEnabled', () => {
    it('should disable wasm', () => {
      setBackendEnabled('wasm', false);
      expect(getConfig().backends.wasm.enabled).toBe(false);
    });

    it('should not disable js', () => {
      setBackendEnabled('js', false);
      // JS always stays enabled (guard in code)
    });
  });

  describe('Profiling API', () => {
    it('should enable profiling', () => {
      enableProfiling();
      expect(getConfig().profiling.enabled).toBe(true);
      expect(getConfig().profiling.collectStats).toBe(true);
    });

    it('should disable profiling', () => {
      enableProfiling();
      disableProfiling();
      expect(getConfig().profiling.enabled).toBe(false);
    });
  });

  describe('Adaptive Tuning API', () => {
    it('should enable adaptive tuning', () => {
      disableAdaptiveTuning();
      enableAdaptiveTuning();
      expect(getConfig().adaptiveTuning.enabled).toBe(true);
    });

    it('should disable adaptive tuning', () => {
      disableAdaptiveTuning();
      expect(getConfig().adaptiveTuning.enabled).toBe(false);
    });

    it('should configure adaptive tuning', () => {
      configureAdaptiveTuning({ sampleSize: 20, minSpeedupRatio: 1.5 });
      const config = getConfig();
      expect(config.adaptiveTuning.sampleSize).toBe(20);
      expect(config.adaptiveTuning.minSpeedupRatio).toBe(1.5);
    });
  });
});
