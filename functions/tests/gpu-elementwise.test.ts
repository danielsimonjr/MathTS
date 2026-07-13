/**
 * Headless tests for the GPU fused-chain DISPATCH LOGIC.
 *
 * Node has no `navigator.gpu`, so no kernel can run here. What IS testable
 * headlessly — and what this file pins — is the gating: the flag, the size
 * threshold, the supported-op set, and the never-throw fall-through that keeps
 * results correct when the GPU is absent. Kernel correctness on a real adapter
 * is covered by `gpu-elementwise.browser.test.ts`.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  elementwiseChainGpuDispatch,
  isGpuChainSupported,
  GPU_ELEMENTWISE_OPS,
} from '../src/gpu/elementwise-gpu.js';
import { fuseUnaryChain, fuseUnaryChainAsync } from '../src/typed/fused.js';
import { enableGpu, disableGpu, isGpuEnabled, GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';

/** Comfortably above the dispatch threshold, so only the flag/device gate it. */
const big = (): Float64Array =>
  Float64Array.from({ length: GPU_MIN_ELEMENTS }, (_, i) => (i % 100) / 100 + 0.01);

afterEach(() => {
  disableGpu();
});

describe('GPU opt-in flag', () => {
  it('is OFF by default', () => {
    expect(isGpuEnabled()).toBe(false);
  });

  it('enableGpu / disableGpu toggle it', () => {
    enableGpu();
    expect(isGpuEnabled()).toBe(true);
    disableGpu();
    expect(isGpuEnabled()).toBe(false);
  });
});

describe('GPU chain support set', () => {
  it('accepts a chain of supported ops', () => {
    expect(isGpuChainSupported(['sin', 'exp'])).toBe(true);
  });

  it('rejects a chain containing an op with no GPU kernel (erfc)', () => {
    // erfc has no WGSL builtin; we refuse rather than silently approximate it.
    expect(isGpuChainSupported(['sin', 'erfc'])).toBe(false);
    expect(GPU_ELEMENTWISE_OPS).not.toContain('erfc');
  });
});

describe('elementwiseChainGpuDispatch gating (never throws, returns null to fall back)', () => {
  it('returns null when the flag is OFF, even for a large supported chain', async () => {
    await expect(elementwiseChainGpuDispatch(['sin', 'exp'], big())).resolves.toBeNull();
  });

  it('returns null below the size threshold', async () => {
    enableGpu();
    const small = Float64Array.from({ length: GPU_MIN_ELEMENTS - 1 }, (_, i) => i / 1000);
    await expect(elementwiseChainGpuDispatch(['sin'], small)).resolves.toBeNull();
  });

  it('returns null for an empty chain', async () => {
    enableGpu();
    await expect(elementwiseChainGpuDispatch([], big())).resolves.toBeNull();
  });

  it('returns null for an unsupported op', async () => {
    enableGpu();
    await expect(elementwiseChainGpuDispatch(['erfc'], big())).resolves.toBeNull();
  });

  it('returns null (not a rejection) when no GPU device exists — as in Node', async () => {
    enableGpu();
    // Flag on, size ok, ops supported: the only remaining gate is the device,
    // which Node cannot provide. Must resolve null, never reject.
    await expect(elementwiseChainGpuDispatch(['sin', 'exp'], big())).resolves.toBeNull();
  });
});

describe('fuseUnaryChainAsync falls through to a correct CPU result', () => {
  it('matches the synchronous chain when the GPU is unavailable', async () => {
    enableGpu(); // even opted in, Node has no device → CPU tiers must answer
    const xs = Float64Array.from({ length: 2048 }, (_, i) => (i % 50) / 50 + 0.01);
    const got = await fuseUnaryChainAsync(['sin', 'exp'], xs);
    const want = fuseUnaryChain(['sin', 'exp'], xs);
    expect(Array.from(got)).toEqual(Array.from(want));
  });

  it('computes exp(sin(x)) left-to-right', async () => {
    const xs = Float64Array.from([0, 0.5, 1, 1.5]);
    const got = await fuseUnaryChainAsync(['sin', 'exp'], xs);
    Array.from(xs).forEach((x, i) => {
      expect(got[i]).toBeCloseTo(Math.exp(Math.sin(x)), 12);
    });
  });
});
