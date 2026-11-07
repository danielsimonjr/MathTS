import { describe, it, expect } from 'vitest';
import { Unit, exactScaleToNumber } from '../../src/index.js';

function scaleOf(text: string): number {
  const s = Unit.parse(text).exactScale();
  if (s === null) throw new Error('no scale');
  return exactScaleToNumber(s);
}

describe('U5 glued products and U6 superscripts', () => {
  it('m2K matches m^2 * K', () => {
    expect(scaleOf('m2K')).toBeCloseTo(scaleOf('m^2*K'), 12);
  });
  it('Vs matches V*s', () => {
    expect(scaleOf('Vs')).toBeCloseTo(scaleOf('V*s'), 12);
  });
  it('cm^2/Vs matches cm^2/(V*s)', () => {
    expect(scaleOf('cm^2/Vs')).toBeCloseTo(scaleOf('cm^2/(V*s)'), 12);
  });
  it('mmin is not a single silent product in MT-2', () => {
    expect(() => Unit.parse('mmin')).toThrow(/not found|ambiguous/i);
  });
  it('NN matches N*N', () => {
    expect(scaleOf('NN')).toBeCloseTo(scaleOf('N*N'), 12);
  });
  it('m⁻¹ matches m^-1', () => {
    expect(scaleOf('m⁻¹')).toBeCloseTo(scaleOf('m^-1'), 12);
  });
  it('K² matches K^2', () => {
    expect(scaleOf('K²')).toBeCloseTo(scaleOf('K^2'), 12);
  });
  it('mm is still the millimetre', () => {
    expect(scaleOf('mm')).toBeCloseTo(scaleOf('m') / 1000, 12);
  });
  it('mly and mpc are refused prefixes, not products', () => {
    expect(() => Unit.parse('mly')).toThrow(/not found/);
    expect(() => Unit.parse('mpc')).toThrow(/not found/);
  });
  it('mAs has two readings until MT-3 and is not found', () => {
    expect(() => Unit.parse('mAs')).toThrow(/not found/);
  });
  it('mol/mL is equal in base to mol/L', () => {
    expect(Unit.parse('mol/mL').equalBase(Unit.parse('mol/L'))).toBe(true);
  });
  it('m/ms is equal in base to m/s', () => {
    expect(Unit.parse('m/ms').equalBase(Unit.parse('m/s'))).toBe(true);
  });
  it('m2K/s matches m^2*K/s', () => {
    expect(scaleOf('m2K/s')).toBeCloseTo(scaleOf('m^2*K/s'), 12);
  });
});
