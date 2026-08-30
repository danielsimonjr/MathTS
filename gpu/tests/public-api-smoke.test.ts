import { describe, it, expect } from 'vitest';
import * as G from '../src/index.js';

describe('gpu public API smoke', () => {
  const fns = Object.entries(G).filter(([, v]) => typeof v === 'function');
  it('exports GPU foundation functions', () => {
    expect(fns.length).toBeGreaterThan(0);
    expect(typeof (G as Record<string, unknown>).isGpuEnabled === 'function').toBe(true);
  });
});
