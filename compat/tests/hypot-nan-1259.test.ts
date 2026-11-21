/**
 * #1259 through the compat instance: `hypot` is NaN when an argument is NaN, also with an
 * infinite argument (mathjs 15.2.0 rule).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const m = create(all) as unknown as { hypot: (...a: unknown[]) => unknown };

describe('compat hypot with a NaN argument (#1259)', () => {
  it('hypot(Infinity, NaN) is NaN', () => {
    expect(m.hypot(Infinity, NaN)).toBeNaN();
  });

  it('hypot([Infinity, NaN]) is NaN', () => {
    expect(m.hypot([Infinity, NaN])).toBeNaN();
  });

  it('hypot(3, 4) is 5 (control)', () => {
    expect(m.hypot(3, 4)).toBe(5);
  });
});
