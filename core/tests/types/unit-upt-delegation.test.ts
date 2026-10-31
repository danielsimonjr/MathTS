/**
 * Issue #347: the units, the parsing and the cycle conversion UPT needs in
 * order to delegate to MathTS. Storage `bit` stays a BIT (1 byte = 8 bit);
 * an information bit is `ln2` nat, registered with `createUnit`'s exact scale.
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
import { DimensionMismatchError } from '../../src/types/unit/errors';

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

  it('accepts UPT day spelling d without breaking decimetre dm', () => {
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

describe('units UPT was keeping locally', () => {
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
