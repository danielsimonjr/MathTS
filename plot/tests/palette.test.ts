import { describe, it, expect } from 'vitest';
import { viridis } from '../src/palette.js';

describe('viridis', () => {
  it('returns hex colors at the endpoints and clamps', () => {
    expect(viridis(0)).toMatch(/^#[0-9a-f]{6}$/);
    expect(viridis(1)).toMatch(/^#[0-9a-f]{6}$/);
    expect(viridis(-5)).toBe(viridis(0));
    expect(viridis(5)).toBe(viridis(1));
  });
  it('is monotonic-ish: 0 and 1 differ', () => {
    expect(viridis(0)).not.toBe(viridis(1));
  });
});
