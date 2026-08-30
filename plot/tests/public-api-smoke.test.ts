import { describe, it, expect } from 'vitest';
import * as P from '../src/index.js';

describe('plot public API smoke', () => {
  const fns = Object.entries(P).filter(([, v]) => typeof v === 'function');
  it('exports plot functions', () => {
    expect(fns.length).toBeGreaterThan(0);
  });
});
