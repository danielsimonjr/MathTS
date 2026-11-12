/**
 * Dogfood relay G33 — exact repros for #826 (DimensionMismatchError on unit add).
 */
import { describe, it, expect } from 'vitest';
import { Unit, DimensionMismatchError } from '@danielsimonjr/mathts-units';
import { add } from '@danielsimonjr/mathts-functions';

describe('G33 dogfood (#826 DimensionMismatchError on unit add)', () => {
  it('matches issue repro: to() vs add() and Unit.add', () => {
    let toError: unknown;
    try {
      new Unit(1, 'm').to('s');
    } catch (e) {
      toError = e;
    }
    expect((toError as Error).name).toBe('DimensionMismatchError');
    expect(toError).toBeInstanceOf(DimensionMismatchError);

    let addError: unknown;
    try {
      add(new Unit(1, 'm'), new Unit(1, 's'));
    } catch (e) {
      addError = e;
    }
    expect((addError as Error).name).toBe('DimensionMismatchError');
    expect(addError).toBeInstanceOf(DimensionMismatchError);
    expect((addError as Error).message.split('\n')[0]).toBe(
      'Cannot add/subtract units with different dimensions'
    );

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
