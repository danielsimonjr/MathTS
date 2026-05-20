import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

/**
 * EXPANSION_PLAN W5 — `compat` exposes the full functions surface.
 * `all` is the real @danielsimonjr/mathts-functions namespace (not an empty
 * placeholder) and `create(all)` surfaces it, with the compat shims overlaid.
 */
describe('compat create(all)', () => {
  it('all is the full functions namespace, not an empty placeholder', () => {
    expect(Object.keys(all).length).toBeGreaterThan(100);
  });

  it('create(all) surfaces the full functions surface', () => {
    const math = create(all);
    expect(typeof math.det).toBe('function');
    expect(typeof math.integrate).toBe('function');
    expect(typeof math.eigs).toBe('function');
    expect(typeof math.simplify).toBe('function');
  });

  it('create() with no arguments defaults to all', () => {
    const math = create();
    expect(typeof math.det).toBe('function');
  });

  it('keeps the compat shims for type constructors and arithmetic', () => {
    const math = create(all);
    expect(typeof math.add).toBe('function');
    expect(math.add(1, 2)).toBe(3);
    expect(typeof math.complex).toBe('function');
  });

  it('config still works', () => {
    const math = create(all);
    expect(math.config().precision).toBe(64);
    math.config({ precision: 32 });
    expect(math.config().precision).toBe(32);
  });

  it('computes a determinant through the surfaced function', () => {
    const math = create(all);
    const det = math.det as (m: number[][]) => number;
    expect(det([[1, 2], [3, 4]])).toBe(-2);
  });
});
