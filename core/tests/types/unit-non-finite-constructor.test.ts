/**
 * Dogfood relay G33 — exact repro for #819.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/types/unit';

describe('G33 dogfood (#819 Unit rejects non-finite numeric value)', () => {
  it('matches issue repro: NaN value and finite guard', () => {
    expect(String(new Unit(1, 'm'))).not.toBe('NaN m');
    expect(() => new Unit(NaN, 'm')).toThrow(TypeError);
    expect(() => new Unit(NaN, 'm')).toThrow(/Unit value must be finite/);
    expect(() => new Unit(Number.POSITIVE_INFINITY, 'm')).toThrow(/Unit value must be finite/);
    expect(() => new Unit(Number.NEGATIVE_INFINITY, 'm')).toThrow(/Unit value must be finite/);
  });
});
