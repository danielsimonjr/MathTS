import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/index.js';

describe('Unit.parse middle dot (M7)', () => {
  it('reads U+00B7 as a product', () => {
    expect(Unit.parse('N·m').equalBase(Unit.parse('N*m'))).toBe(true);
    expect(Unit.parse('kg·m^2').equalBase(Unit.parse('kg*m^2'))).toBe(true);
  });
  it('keeps the dot inside a parenthesised denominator', () => {
    expect(Unit.parse('m^2/(V·s)').equalBase(Unit.parse('m^2/(V*s)'))).toBe(true);
    expect(Unit.parse('m^2/(V·s)').equalBase(Unit.parse('m^2/V/s'))).toBe(true);
  });
  it('keeps the dot in the denominator after a solidus', () => {
    expect(Unit.parse('W/m·K').equalBase(Unit.parse('W/(m*K)'))).toBe(true);
  });
  it('accepts spaces around the dot and a dot after a leading value', () => {
    expect(Unit.parse('N · m').equalBase(Unit.parse('N*m'))).toBe(true);
    const u = Unit.parse('2·m');
    expect(u.equalBase(Unit.parse('m'))).toBe(true);
    expect(u.toNumber('m')).toBe(2);
  });
  it('refuses a trailing or a leading dot', () => {
    expect(() => Unit.parse('N·')).toThrow();
    expect(() => Unit.parse('·N')).toThrow();
  });
});
