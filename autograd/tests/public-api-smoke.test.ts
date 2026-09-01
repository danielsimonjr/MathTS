import { describe, it, expect } from 'vitest';
import * as A from '../src/index.js';

describe('autograd public API smoke', () => {
  const fns = Object.entries(A).filter(([, v]) => typeof v === 'function');
  it('exports autodiff entry points', () => {
    expect(fns.length).toBeGreaterThan(0);
  });
});
