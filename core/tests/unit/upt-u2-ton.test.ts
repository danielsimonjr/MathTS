import { describe, it, expect } from 'vitest';
import { Unit, AmbiguousUnitError, exactScaleToNumber } from '../../src/index.js';

describe('UPT-U2 ton spelling is ambiguous', () => {
  it('Unit.parse("ton") throws AmbiguousUnitError with the three readings', () => {
    let caught: unknown;
    try {
      Unit.parse('ton');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AmbiguousUnitError);
    const err = caught as AmbiguousUnitError;
    expect(err.readings).toEqual(['longton', 'shortton', 't']);
    expect(err.message).toMatch(/tonne/);
  });

  it('Unit.parse("tons") throws AmbiguousUnitError', () => {
    expect(() => Unit.parse('tons')).toThrow(AmbiguousUnitError);
  });

  it('Unit.parse("5 ton") throws AmbiguousUnitError', () => {
    expect(() => Unit.parse('5 ton')).toThrow(AmbiguousUnitError);
  });

  it('t and tonne stay 1000 kg', () => {
    expect(exactScaleToNumber(Unit.exactScale('t')!)).toBe(1000);
    expect(exactScaleToNumber(Unit.exactScale('tonne')!)).toBe(1000);
  });

  it('shortton is 2000 pounds and longton is 2240 pounds', () => {
    const pound = exactScaleToNumber(Unit.exactScale('lb')!);
    expect(exactScaleToNumber(Unit.exactScale('shortton')!)).toBeCloseTo(2000 * pound, 6);
    expect(exactScaleToNumber(Unit.exactScale('longton')!)).toBeCloseTo(2240 * pound, 6);
  });

  it('lys keeps the product hint from MT-3', () => {
    expect(() => Unit.parse('lys')).toThrow('Write the product with "*"');
  });
});
