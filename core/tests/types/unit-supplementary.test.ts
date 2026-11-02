/**
 * Supplementary units, ISO 80000 solidus parsing, unicode spellings, and cycle
 * conversion. Storage `bit` stays a BIT (1 byte = 8 bit); an information bit is
 * `ln2` nat, registered with `createUnit`'s exact scale.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/types/unit';
import {
  LN2_EXACT_SCALE,
  PI_EXACT_SCALE,
  exactScaleToNumber,
  multiplyExactScales,
  ratioExactScale,
} from '../../src/index';
import { DimensionMismatchError, UnitParseError } from '../../src/types/unit/errors';
import { REFUSED_UNIT_SPELLINGS } from '../../src/types/unit/unit-table';

const twoPi = exactScaleToNumber(multiplyExactScales(ratioExactScale(2), PI_EXACT_SCALE));

describe('ISO 80000 single solidus', () => {
  it('reads W/m*K as W/(m·K), including an implicit product and a second solidus', () => {
    const thermal = new Unit(1, 'W/m*K');
    expect(thermal.to('W/(m*K)').toNumeric()).toBe(1);
    expect(new Unit(1, 'W/m K').to('W/(m*K)').toNumeric()).toBe(1);
    expect(new Unit(1, 'J/kg/K').to('J/(kg*K)').toNumeric()).toBe(1);
    expect(() => thermal.to('W*K/m')).toThrow(DimensionMismatchError);
  });

  it('keeps a product outside a parenthesized quotient in the numerator', () => {
    expect(new Unit(1, '(W/m)*K').to('W*K/m').toNumeric()).toBe(1);
    expect(new Unit(1, 'kg*m/s^2').to('N').toNumeric()).toBe(1);
    expect(new Unit(1, '1/s*m').to('s^-1*m^-1').toNumeric()).toBe(1);
  });
});

describe('unicode unit spellings', () => {
  it('accepts µ, μ, Ω, ℃ and Å', () => {
    expect(new Unit(1, 'µm').toNumeric('m')).toBe(1e-6);
    expect(new Unit(1, 'μm').toNumeric('m')).toBe(1e-6);
    expect(new Unit(1, 'kΩ').toNumeric('ohm')).toBe(1000);
    expect(new Unit(1, 'µΩ').toNumeric('ohm')).toBe(1e-6);
    expect(new Unit(100, '℃').toNumeric('K')).toBe(373.15);
    expect(new Unit(1, 'Å').toNumeric('m')).toBe(1e-10);
    expect(new Unit(1, '%').toNumeric('ppm')).toBe(10000);
  });

  it('treats d as the day without breaking decimetre dm', () => {
    expect(new Unit(1, 'd').toNumeric('s')).toBe(86400);
    expect(new Unit(1, 'dm').toNumeric('m')).toBe(0.1);
    expect(new Unit(1, 'day').toNumeric('s')).toBe(86400);
    expect(new Unit(1, 'Angstrom').toNumeric('m')).toBe(1e-10);
  });
});

describe('cycles and radians', () => {
  it('converts a cycle rate to radians and leaves a plain rate alone', () => {
    expect(new Unit(1, 'Hz').toNumeric('rad/s')).toBe(twoPi);
    expect(new Unit(1, 'Hz').toNumeric('deg/s')).toBe(360);
    expect(new Unit(1, 'Hz').toNumeric('s^-1')).toBe(1);
    expect(new Unit(60, 'rpm').toNumeric('Hz')).toBe(1);
    expect(new Unit(60, 'rpm').toNumeric('rad/s')).toBe(twoPi);
    expect(new Unit(1, 'cycle/s').toNumeric('Hz')).toBe(1);
    expect(() => new Unit(1, 's^-1').to('rad/s')).toThrow(DimensionMismatchError);
    expect(new Unit(1, 'byte').to('bit').toString()).toBe('8 bit');
  });
});

describe('supplementary built-in units', () => {
  it('parses the prefixed spellings that share a letter with a new unit', () => {
    expect(new Unit(1, 'GPa').toNumeric('Pa')).toBe(1e9);
    expect(new Unit(1, 'Pm').toNumeric('m')).toBe(1e15);
    expect(new Unit(1, 'MPa').toNumeric('Pa')).toBe(1e6);
    expect(new Unit(1, 'um').toNumeric('m')).toBe(1e-6);
    expect(new Unit(1, 'kDa').toNumeric('Da')).toBe(1000);
    expect(new Unit(1, 'G').toNumeric('T')).toBe(1e-4);
    expect(new Unit(1, 'cP').toNumeric('Pa s')).toBe(0.001);
    expect(new Unit(1, 'M').toNumeric('mol/L')).toBe(1);
    expect(new Unit(1, 'u').toNumeric('kg')).toBe(1.66053906892e-27);
  });

  it('uses the defining values', () => {
    expect(new Unit(1, 'au').toNumeric('m')).toBe(149597870700);
    expect(new Unit(1, 'Msun').toNumeric('kg')).toBe(1.989e30);
    expect(new Unit(1, 'Msun_iau').toNumeric('kg')).toBe(1.3271244e20 / 6.6743e-11);
    expect(new Unit(1, 'mph').toNumeric('m/s')).toBe(0.44704);
    expect(new Unit(1, 'knot').toNumeric('m/s')).toBe(1852 / 3600);
    expect(new Unit(1, 'lm').toNumeric('cd sr')).toBe(1);
    expect(new Unit(1, 'lx').toNumeric('lm/m^2')).toBe(1);
    expect(new Unit(1, 'Jy').toNumeric('W/m^2/Hz')).toBe(1e-26);
    expect(new Unit(1, 'c').toNumeric('m/s')).toBe(299792458);
    expect(new Unit(1, 'nat').toNumeric()).toBe(1);
  });

  it('parses SI-prefixed spellings of psi and torr', () => {
    expect(new Unit(1, 'kpsi').toNumeric('psi')).toBe(1000);
    expect(new Unit(1, 'Mpsi').toNumeric('psi')).toBe(1e6);
    expect(new Unit(1, 'mtorr').toNumeric('torr')).toBe(1e-3);
    expect(new Unit(1, 'utorr').toNumeric('torr')).toBe(1e-6);
    expect(new Unit(1, 'kpsi').toNumeric('Pa')).toBeCloseTo(1000 * 6894.757293168362, 6);
    expect(new Unit(1, 'Mpsi').toNumeric('Pa')).toBeCloseTo(1e6 * 6894.757293168362, 3);
    expect(new Unit(1, 'mtorr').toNumeric('Pa')).toBeCloseTo(133.32236842105263 / 1000, 9);
    expect(new Unit(1, 'utorr').toNumeric('Pa')).toBeCloseTo(133.32236842105263 / 1e6, 12);
  });

  it('still refuses a downward prefix on pc', () => {
    expect(new Unit(1, 'Mpc').toNumeric('pc')).toBe(1e6);
    expect(() => new Unit(1, 'mpc')).toThrow();
  });
});

describe('refused unit spellings', () => {
  const REFUSE_REASONS: readonly [string, string][] = [
    ['dB', 'dB is a logarithmic unit; give the quantity in its linear unit, or a reference level'],
    ['dBm', 'dBm is a logarithmic unit (decibels over 1 mW); give watts'],
    ['dBW', 'dBW is a logarithmic unit (decibels over 1 W); give watts'],
    [
      'Np',
      'Np is a logarithmic unit (the neper); give the quantity in its linear unit, or a reference level',
    ],
    [
      'Mach',
      'Mach is a ratio to the local speed of sound; give m/s, or the ratio as a bare number',
    ],
    [
      'mach',
      'mach is a ratio to the local speed of sound; give m/s, or the ratio as a bare number',
    ],
  ];

  it('refuses each spelling with its reason, in the UnitParseError the parser throws', () => {
    for (const [spelling, reason] of REFUSE_REASONS) {
      expect(() => new Unit(1, spelling)).toThrow(UnitParseError);
      expect(() => new Unit(1, spelling)).toThrow(`Unit "${spelling}" is refused: ${reason}`);
    }
  });

  it('refuses a spelling inside a compound unit', () => {
    expect(() => new Unit(1, 'dB/m')).toThrow(
      'Unit "dB" is refused: dB is a logarithmic unit; give the quantity in its linear unit, or a reference level'
    );
    expect(() => new Unit(1, 'mach/s')).toThrow(
      'Unit "mach" is refused: mach is a ratio to the local speed of sound; give m/s, or the ratio as a bare number'
    );
    expect(() => new Unit(1, 's/dB')).toThrow(
      'Unit "dB" is refused: dB is a logarithmic unit; give the quantity in its linear unit, or a reference level'
    );
  });

  it('keeps the not-found report for a spelling that is not refused', () => {
    expect(() => new Unit(1, 'nonesuch')).toThrow('Unit "nonesuch" not found.');
    // A name on Object.prototype is not a refused reason.
    expect(() => new Unit(1, 'toString')).toThrow('Unit "toString" not found.');
    // `__proto__` is not even a unit token, and never a refused reason.
    expect(() => new Unit(1, '__proto__')).toThrow(UnitParseError);
    expect(() => new Unit(1, '__proto__')).toThrow(/Unexpected "_"/);
  });

  it('matches the spellings exactly, never with a prefix or another case', () => {
    for (const spelling of Object.keys(REFUSED_UNIT_SPELLINGS)) {
      const msg = `Unit "${spelling}" is refused:`;
      expect(() => new Unit(1, spelling)).toThrow(msg);
    }
    // Same case, prefix-attached forms stay "not found" (or prefix + a refused
    // bare spelling never forms one name).
    expect(() => new Unit(1, 'kMach')).toThrow(/not found/);
    expect(() => new Unit(1, 'dBs')).toThrow(/not found/);
  });
});

describe('createUnit exact scales', () => {
  it('registers an information bit as ln 2 nat and leaves a float definition inexact', () => {
    Unit.createUnit({
      shannon: { definition: '1 nat', exact: 'ln2', aliases: ['shannons'] },
      floater: '0.2 m',
    });
    try {
      expect(new Unit(1, 'shannon').toNumeric('nat')).toBe(exactScaleToNumber(LN2_EXACT_SCALE));
      expect(new Unit(1, 'shannons').toNumeric('nat')).toBe(exactScaleToNumber(LN2_EXACT_SCALE));
      expect(Unit.exactScale('shannon')).toEqual(LN2_EXACT_SCALE);
      expect(Unit.exactScale('floater')).toBeNull();
    } finally {
      Unit.deleteUnit('shannon');
      Unit.deleteUnit('shannons');
      Unit.deleteUnit('floater');
    }
  });
});
