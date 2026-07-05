import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/index.js';

/**
 * GC11 — external-reference guard for the unit conversion kernel. The internal
 * unit tests derive expectations from the same definition constants (a 10%-wrong
 * factor would still pass). These values are pinned to NIST SP 811 / CODATA-2018
 * so a definition change that diverges from the standard is caught.
 */
describe('GC11: unit conversions vs NIST/CODATA reference values', () => {
  // [value, from, to, expected, sigFigs] — expected from NIST SP 811 App. B.
  const refs: [number, string, string, number, number][] = [
    [1, 'inch', 'm', 0.0254, 12], // exact
    [1, 'ft', 'm', 0.3048, 12], // exact
    [1, 'yd', 'm', 0.9144, 12], // exact
    [1, 'mile', 'm', 1609.344, 9], // exact (international mile)
    [1, 'lb', 'kg', 0.45359237, 12], // exact (avoirdupois)
    [1, 'km', 'm', 1000, 12],
    [1, 'cm', 'm', 0.01, 12],
    [1, 'mm', 'm', 0.001, 12],
    [1, 'g', 'kg', 0.001, 12],
    [1, 'day', 's', 86400, 9],
    [1, 'atm', 'Pa', 101325, 6], // standard atmosphere (exact)
    [1, 'bar', 'Pa', 100000, 6], // exact
    [1, 'L', 'm^3', 0.001, 12],
    [1, 'eV', 'J', 1.602176634e-19, 12], // CODATA-2018 exact
  ];

  for (const [v, from, to, expected, sig] of refs) {
    it(`${v} ${from} = ${expected} ${to}`, () => {
      expect(new Unit(v, from).to(to).value).toBeCloseTo(
        expected,
        sig - Math.ceil(Math.log10(Math.abs(expected) || 1))
      );
    });
  }

  it('temperature offsets match the standard anchors', () => {
    expect(new Unit(0, 'degC').to('K').value).toBeCloseTo(273.15, 10);
    expect(new Unit(100, 'degC').to('K').value).toBeCloseTo(373.15, 10);
    expect(new Unit(32, 'degF').to('K').value).toBeCloseTo(273.15, 6);
    expect(new Unit(212, 'degF').to('K').value).toBeCloseTo(373.15, 6);
  });
});

describe('B-5 port: astronomical / nautical / typography units (upstream ece1aab0f + 5f360326b)', () => {
  // IAU / exact reference values.
  const refs: [string, number][] = [
    ['astronomicalUnit', 1.495978707e11], // IAU 2012 exact
    ['AU', 1.495978707e11],
    ['lightyear', 9.4607304725808e15], // Julian year × c, exact
    ['ly', 9.4607304725808e15],
    ['parsec', 3.08567758149137e16], // IAU 2015 exact
    ['pc', 3.08567758149137e16],
    ['nauticalMile', 1852],
    ['nmi', 1852],
    ['fathom', 1.8288],
    ['furlong', 201.168],
    ['point', 0.0254 / 72],
    ['pica', 0.0254 / 6],
  ];
  for (const [u, meters] of refs) {
    it(`1 ${u} = ${meters} m`, () => {
      expect(new Unit(1, u).toNumeric('m') as number).toBeCloseTo(meters, meters > 1 ? -1 : 12);
    });
  }

  it('cosmological prefixes resolve upward only: kpc/Mpc/Mly work', () => {
    expect(new Unit(1, 'kpc').toNumeric('pc') as number).toBeCloseTo(1000, 6);
    expect(new Unit(1, 'Mpc').toNumeric('pc') as number).toBeCloseTo(1e6, 3);
    expect(new Unit(1, 'Mly').toNumeric('ly') as number).toBeCloseTo(1e6, 3);
    expect(new Unit(1, 'megaparsec').toNumeric('parsec') as number).toBeCloseTo(1e6, 3);
  });

  it('sub-multiples of ly/pc throw instead of silently misparsing (mly ≠ mega-ly)', () => {
    expect(() => new Unit(1, 'mly')).toThrow();
    expect(() => new Unit(1, 'nly')).toThrow();
    expect(() => new Unit(1, 'mpc')).toThrow();
  });

  it("lowercase 'au' stays undefined (collides with the Bohr-radius atomic unit)", () => {
    expect(() => new Unit(1, 'au')).toThrow();
  });
});
