import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config.js';
import type { ConfigOptions } from '../src/config.js';

describe('DEFAULT_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONFIG.relTol).toBe(1e-12);
    expect(DEFAULT_CONFIG.absTol).toBe(1e-15);
    expect(DEFAULT_CONFIG.matrix).toBe('Matrix');
    expect(DEFAULT_CONFIG.number).toBe('number');
    expect(DEFAULT_CONFIG.numberFallback).toBe('number');
    expect(DEFAULT_CONFIG.precision).toBe(64);
    expect(DEFAULT_CONFIG.predictable).toBe(false);
    expect(DEFAULT_CONFIG.randomSeed).toBeNull();
    expect(DEFAULT_CONFIG.legacySubset).toBe(false);
  });

  it('should have all required fields', () => {
    const keys: (keyof ConfigOptions)[] = [
      'relTol', 'absTol', 'matrix', 'number', 'numberFallback',
      'precision', 'predictable', 'randomSeed', 'legacySubset',
    ];
    for (const key of keys) {
      expect(DEFAULT_CONFIG).toHaveProperty(key);
    }
  });
});
