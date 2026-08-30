import { describe, it, expect } from 'vitest';
import * as C from '../src/index.js';

describe('compat public API smoke', () => {
  const fns = Object.entries(C).filter(([, v]) => typeof v === 'function');
  it('exports create()', () => {
    expect(fns.length).toBeGreaterThan(0);
    expect(typeof (C as Record<string, unknown>).create).toBe('function');
  });
});
