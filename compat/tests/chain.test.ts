import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

/**
 * GC12 — fluent chain API parity with mathjs.
 */
describe('GC12: math.chain', () => {
  const math = create(all);

  it('chains arithmetic and unwraps with done()', () => {
    expect(math.chain(3).add(4).multiply(2).done()).toBe(14);
  });

  it('single-step chain', () => {
    expect(math.chain(10).subtract(3).done()).toBe(7);
  });

  it('valueOf unwraps the value', () => {
    const c = math.chain(5).add(1);
    expect(c.valueOf()).toBe(6);
  });

  it('works with the broader function surface (sqrt)', () => {
    expect(math.chain(16).sqrt().done()).toBe(4);
  });
});
