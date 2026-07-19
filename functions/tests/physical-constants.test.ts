import { describe, it, expect } from 'vitest';
import {
  speedOfLight,
  planckConstant,
  electronMass,
  avogadro,
  boltzmann,
  fineStructure,
  efimovFactor,
  weakMixingAngle,
  gravity,
} from '../src/factories/index.js';

/**
 * Physical constants activation (EXPANSION_PLAN W1).
 * Activated under the default `number` config — unit-valued constants are
 * `Unit` instances; dimensionless constants are plain numbers.
 */
describe('physical constants', () => {
  it('exposes unit-valued constants as Unit instances', () => {
    expect(speedOfLight).toBeDefined();
    expect((speedOfLight as { toNumeric(): number }).toNumeric()).toBe(299792458);
  });

  it('matches known SI values for unit constants', () => {
    const c = (u: unknown) => (u as { toNumeric(): number }).toNumeric();
    expect(c(planckConstant)).toBeCloseTo(6.62607015e-34, 44);
    expect(c(electronMass)).toBeCloseTo(9.1093837139e-31, 41); // CODATA-2022
    expect(c(boltzmann)).toBeCloseTo(1.380649e-23, 29);
    // avogadro ~6.022e23 — compare on a relative basis
    expect(c(avogadro) / 6.02214076e23).toBeCloseTo(1, 6);
    expect(c(gravity)).toBeCloseTo(9.80665, 5);
  });

  it('exposes dimensionless constants as plain numbers', () => {
    expect(fineStructure).toBeCloseTo(0.0072973525643, 13); // CODATA-2022
    expect(efimovFactor).toBeCloseTo(22.7, 6);
    expect(weakMixingAngle).toBeCloseTo(0.22305, 6); // CODATA-2022
  });
});
