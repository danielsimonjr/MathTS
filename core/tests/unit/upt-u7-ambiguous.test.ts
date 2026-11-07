import { describe, it, expect } from 'vitest';
import { Unit, AmbiguousUnitError, UnitParseError } from '../../src/index.js';

describe('UPT-U7 ambiguous glued unit tokens', () => {
  it('throws AmbiguousUnitError for lys and names every reading', () => {
    let caught: unknown;
    try {
      Unit.parse('lys');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AmbiguousUnitError);
    const err = caught as AmbiguousUnitError;
    expect(err.readings.length).toBeGreaterThanOrEqual(2);
    expect(err.message).toContain('lys');
    expect(err.message.toLowerCase()).toContain('ambiguous');
  });

  it('throws AmbiguousUnitError for incd', () => {
    expect(() => Unit.parse('incd')).toThrow(AmbiguousUnitError);
  });

  it('AmbiguousUnitError is a UnitParseError', () => {
    let caught: unknown;
    try {
      Unit.parse('lys');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnitParseError);
  });

  it('mAs throws UnitParseError but not AmbiguousUnitError (rule 2b refuses it first)', () => {
    let caught: unknown;
    try {
      Unit.parse('mAs');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnitParseError);
    expect(caught).not.toBeInstanceOf(AmbiguousUnitError);
  });

  it('still parses m2K and mm', () => {
    expect(() => Unit.parse('m2K')).not.toThrow();
    expect(() => Unit.parse('mm')).not.toThrow();
  });
});
