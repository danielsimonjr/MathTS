import { afterEach, describe, expect, it } from 'vitest';
import { setDeterministic } from '@danielsimonjr/mathts-core';
import { BackendManager } from '../../src/backends/BackendManager.js';

afterEach(() => setDeterministic(false));

describe('BackendManager in deterministic mode', () => {
  it('selects JS even when WASM is preferred', async () => {
    const mgr = new BackendManager();
    await mgr.initialize();
    mgr.setHints({ preferredBackend: 'wasm' });
    // Off: the preferred backend wins (liveness of the gate below).
    expect(mgr.selectBackend(1_000_000, 'multiply').type).toBe('wasm');
    setDeterministic(true);
    expect(mgr.selectBackend(1_000_000, 'multiply').type).toBe('js');
    expect(mgr.selectBackend(1_000_000).type).toBe('js');
  });
});
