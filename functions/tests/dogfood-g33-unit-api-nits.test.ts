/**
 * Dogfood relay G33 — exact repros for #826.
 */
import { describe, it, expect } from 'vitest';
import { Unit, DimensionMismatchError } from '@danielsimonjr/mathts-units';
import { add } from '@danielsimonjr/mathts-functions';

describe('G33 dogfood (#826 DimensionMismatchError on unit add)', () => {
  it('matches issue repro: to() vs add() and Unit.add', () => {
    try {
      new Unit(1, 'm').to('s');
    } catch (e) {
      expect((e as Error).name).toBe('DimensionMismatchError');
      expect(e).toBeInstanceOf(DimensionMismatchError);
    }

    try {
      add(new Unit(1, 'm'), new Unit(1, 's'));
    } catch (e) {
      expect((e as Error).name).toBe('DimensionMismatchError');
      expect(e).toBeInstanceOf(DimensionMismatchError);
      expect((e as Error).message.split('\n')[0]).toBe(
        'Cannot add/subtract units with different dimensions'
      );
    }

    expect(typeof new Unit(1, 'm').add).toBe('function');
    const sum = add(new Unit(1, 'm'), new Unit(2, 'm'));
    expect(String(sum)).toBe('3 m');
  });

  it('Unit.add throws DimensionMismatchError for incompatible dimensions', () => {
    const m = new Unit(1, 'm');
    expect(() => m.add(new Unit(1, 's'))).toThrow(DimensionMismatchError);
  });

  it('Unit.add combines same-dimension values', () => {
    const out = new Unit(1, 'm').add(new Unit(2, 'm'));
    expect(String(out)).toBe('3 m');
  });
});
