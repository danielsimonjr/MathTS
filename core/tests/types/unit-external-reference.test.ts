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
      expect(new Unit(v, from).to(to).value).toBeCloseTo(expected, sig - Math.ceil(Math.log10(Math.abs(expected) || 1)));
    });
  }

  it('temperature offsets match the standard anchors', () => {
    expect(new Unit(0, 'degC').to('K').value).toBeCloseTo(273.15, 10);
    expect(new Unit(100, 'degC').to('K').value).toBeCloseTo(373.15, 10);
    expect(new Unit(32, 'degF').to('K').value).toBeCloseTo(273.15, 6);
    expect(new Unit(212, 'degF').to('K').value).toBeCloseTo(373.15, 6);
  });
});
