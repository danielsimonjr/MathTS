/**
 * Tests for matrix/src/backends/Backend.ts
 *
 * Covers the BackendRegistry: register/get/has/initialize/available, hint
 * management, and the size-threshold selectBackend() decision tree. We use a
 * local registry instance (not the global one) so tests stay isolated, plus a
 * minimal fake backend implementing the MatrixBackend contract.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BackendRegistry,
  DEFAULT_BACKEND_HINTS,
  type MatrixBackend,
  type BackendType,
} from '../../src/backends/Backend.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';

/** A no-frills backend stub whose availability is configurable. */
function makeFakeBackend(type: BackendType, available = true): MatrixBackend {
  const passthrough = (a: DenseMatrix) => a;
  return {
    type,
    isAvailable: () => available,
    initialize: async () => {},
    add: (a) => a,
    subtract: (a) => a,
    multiplyElementwise: (a) => a,
    divideElementwise: (a) => a,
    scale: (a) => a,
    abs: passthrough,
    negate: passthrough,
    multiply: (a) => a,
    transpose: passthrough,
    sum: () => 0,
    sumAxis: (a) => a,
    norm: () => 0,
    dot: () => 0,
  };
}

describe('DEFAULT_BACKEND_HINTS', () => {
  it('uses sensible default thresholds and js as the preferred backend', () => {
    expect(DEFAULT_BACKEND_HINTS.wasmThreshold).toBe(1000);
    expect(DEFAULT_BACKEND_HINTS.gpuThreshold).toBe(100000);
    expect(DEFAULT_BACKEND_HINTS.preferredBackend).toBe('js');
  });
});

describe('BackendRegistry — register / get / has', () => {
  let reg: BackendRegistry;
  beforeEach(() => {
    reg = new BackendRegistry();
  });

  it('register() then get() returns the same backend', () => {
    const js = makeFakeBackend('js');
    reg.register(js);
    expect(reg.get('js')).toBe(js);
  });

  it('get() returns undefined for an unregistered backend', () => {
    expect(reg.get('gpu')).toBeUndefined();
  });

  it('has() is false for unregistered backends', () => {
    expect(reg.has('wasm')).toBe(false);
  });

  it('has() is true for a registered, available backend', () => {
    reg.register(makeFakeBackend('wasm', true));
    expect(reg.has('wasm')).toBe(true);
  });

  it('has() is false for a registered but unavailable backend', () => {
    reg.register(makeFakeBackend('gpu', false));
    expect(reg.has('gpu')).toBe(false);
  });
});

describe('BackendRegistry — available()', () => {
  let reg: BackendRegistry;
  beforeEach(() => {
    reg = new BackendRegistry();
  });

  it('returns only available backends', () => {
    reg.register(makeFakeBackend('js', true));
    reg.register(makeFakeBackend('wasm', true));
    reg.register(makeFakeBackend('gpu', false));
    const avail = reg.available();
    expect(avail).toContain('js');
    expect(avail).toContain('wasm');
    expect(avail).not.toContain('gpu');
  });

  it('returns an empty array when nothing is registered', () => {
    expect(reg.available()).toEqual([]);
  });
});

describe('BackendRegistry — initialize()', () => {
  let reg: BackendRegistry;
  beforeEach(() => {
    reg = new BackendRegistry();
  });

  it('initializes a registered backend exactly once', async () => {
    let initCount = 0;
    const backend = makeFakeBackend('wasm');
    backend.initialize = async () => {
      initCount++;
    };
    reg.register(backend);
    await reg.initialize('wasm');
    await reg.initialize('wasm'); // second call is a no-op
    expect(initCount).toBe(1);
  });

  it('throws when initializing an unregistered backend', async () => {
    await expect(reg.initialize('gpu')).rejects.toThrow('Backend not registered: gpu');
  });
});

describe('BackendRegistry — hints', () => {
  let reg: BackendRegistry;
  beforeEach(() => {
    reg = new BackendRegistry();
  });

  it('getHints() returns a copy of the default hints initially', () => {
    expect(reg.getHints()).toEqual(DEFAULT_BACKEND_HINTS);
  });

  it('setHints() merges partial hints', () => {
    reg.setHints({ wasmThreshold: 42 });
    expect(reg.getHints().wasmThreshold).toBe(42);
    // unspecified hints retain their defaults
    expect(reg.getHints().gpuThreshold).toBe(DEFAULT_BACKEND_HINTS.gpuThreshold);
  });

  it('getHints() returns a fresh object (mutating it does not affect the registry)', () => {
    const h = reg.getHints();
    h.wasmThreshold = 999;
    expect(reg.getHints().wasmThreshold).toBe(DEFAULT_BACKEND_HINTS.wasmThreshold);
  });
});

describe('BackendRegistry — selectBackend()', () => {
  let reg: BackendRegistry;
  beforeEach(() => {
    reg = new BackendRegistry();
    reg.register(makeFakeBackend('js', true));
  });

  it('falls back to the JS backend for small inputs', () => {
    const sel = reg.selectBackend(10);
    expect(sel.type).toBe('js');
  });

  it('throws when no JS backend is available', () => {
    const empty = new BackendRegistry();
    expect(() => empty.selectBackend(10)).toThrow('No backend available');
  });

  it('selects the WASM backend above the wasm threshold once initialized', async () => {
    reg.register(makeFakeBackend('wasm', true));
    await reg.initialize('wasm');
    const sel = reg.selectBackend(5000);
    expect(sel.type).toBe('wasm');
  });

  it('does NOT select an uninitialized WASM backend, even above threshold', () => {
    reg.register(makeFakeBackend('wasm', true));
    // never initialized
    const sel = reg.selectBackend(5000);
    expect(sel.type).toBe('js');
  });

  it('selects GPU above the gpu threshold once initialized', async () => {
    reg.register(makeFakeBackend('wasm', true));
    reg.register(makeFakeBackend('gpu', true));
    await reg.initialize('wasm');
    await reg.initialize('gpu');
    const sel = reg.selectBackend(200000);
    expect(sel.type).toBe('gpu');
  });

  it('honors a preferred backend when available and initialized', async () => {
    reg.register(makeFakeBackend('wasm', true));
    await reg.initialize('wasm');
    reg.setHints({ preferredBackend: 'wasm' });
    const sel = reg.selectBackend(1); // tiny input, but preferred wins
    expect(sel.type).toBe('wasm');
  });

  it('ignores a preferred backend that is registered but not initialized', () => {
    reg.register(makeFakeBackend('wasm', true));
    reg.setHints({ preferredBackend: 'wasm' });
    const sel = reg.selectBackend(1);
    expect(sel.type).toBe('js');
  });
});
