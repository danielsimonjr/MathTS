import { describe, it, expect } from 'vitest';
import * as F from '../src/factories/index.js';

/**
 * CODATA-2022 oracle guard for the physical constants.
 *
 * Every physical constant exported from `factories/index.ts` is pinned to the
 * value published by `scipy.constants` (which tracks CODATA-2022 as of
 * scipy 1.17). Regenerate the EXPECTED table with:
 *
 *   python -c "from scipy.constants import physical_constants as P; print(P['electron mass'][0])"
 *
 * This is the standing guard that stops the constants silently drifting a
 * CODATA cycle behind (they were CODATA-2018 until 2026-07). Derived constants
 * that scipy does not tabulate directly (coulomb / coulombConstant / planckCharge)
 * are computed from scipy's vacuum-permittivity / reduced-Planck / c values.
 *
 * `efimovFactor` is an approximate theoretical constant, NOT a CODATA table
 * entry, so it is pinned to its own literal value.
 */

// scipy.constants (CODATA-2022) values — copied verbatim from python repr, do not hand-edit.
const CODATA_2022: Record<string, number> = {
  speedOfLight: 299792458.0,
  gravitationConstant: 6.6743e-11,
  planckConstant: 6.62607015e-34,
  reducedPlanckConstant: 1.0545718176461565e-34,
  magneticConstant: 1.25663706127e-6,
  electricConstant: 8.8541878188e-12,
  vacuumImpedance: 376.730313412,
  coulomb: 8987551786.170797,
  coulombConstant: 8987551786.170797,
  elementaryCharge: 1.602176634e-19,
  bohrMagneton: 9.2740100657e-24,
  conductanceQuantum: 7.748091729863649e-5,
  inverseConductanceQuantum: 12906.403729652257,
  magneticFluxQuantum: 2.0678338484619295e-15,
  nuclearMagneton: 5.0507837393e-27,
  klitzing: 25812.807459304513,
  josephson: 483597848416983.6,
  bohrRadius: 5.29177210544e-11,
  classicalElectronRadius: 2.8179403205e-15,
  electronMass: 9.1093837139e-31,
  fermiCoupling: 1.1663787e-5,
  fineStructure: 0.0072973525643,
  hartreeEnergy: 4.359744722206e-18,
  protonMass: 1.67262192595e-27,
  deuteronMass: 3.3435837768e-27,
  neutronMass: 1.67492750056e-27,
  quantumOfCirculation: 0.00036369475467,
  rydberg: 10973731.568157,
  thomsonCrossSection: 6.6524587051e-29,
  weakMixingAngle: 0.22305,
  atomicMass: 1.66053906892e-27,
  avogadro: 6.02214076e23,
  boltzmann: 1.380649e-23,
  faraday: 96485.33212331001,
  firstRadiation: 3.7417718521927573e-16,
  loschmidt: 2.686780111798444e25,
  gasConstant: 8.31446261815324,
  molarPlanckConstant: 3.990312712893431e-10,
  molarVolume: 0.022413969545014137,
  sackurTetrode: -1.16487052149,
  secondRadiation: 0.014387768775039337,
  stefanBoltzmann: 5.6703744191844314e-8,
  wienDisplacement: 0.0028977719551851727,
  molarMass: 0.00100000000105,
  molarMassC12: 0.0120000000126,
  gravity: 9.80665,
  planckLength: 1.616255e-35,
  planckMass: 2.176434e-8,
  planckTime: 5.391247e-44,
  planckCharge: 1.8755460384151476e-18,
  planckTemperature: 1.416784e32,
};

/** Non-CODATA theoretical constant — pinned to its own literal. */
const NON_CODATA: Record<string, number> = {
  efimovFactor: 22.7,
};

/** Extract the numeric magnitude from a Unit-valued or number-valued constant. */
function numericOf(value: unknown): number {
  if (typeof value === 'number') return value;
  return (value as { toNumeric(): number }).toNumeric();
}

describe('physical constants — CODATA-2022 oracle (scipy.constants)', () => {
  for (const [name, expected] of Object.entries(CODATA_2022)) {
    it(`${name} matches scipy CODATA-2022 (${expected})`, () => {
      const actual = numericOf((F as Record<string, unknown>)[name]);
      expect(Number.isFinite(actual)).toBe(true);
      // Relative error: the parsed literal must equal scipy's value to double
      // precision (~1e-16). 1e-11 also catches a full CODATA-cycle drift, whose
      // smallest mover here (masses/α) is ~1e-9 relative.
      const relErr = Math.abs(actual / expected - 1);
      expect(relErr).toBeLessThan(1e-13);
    });
  }

  for (const [name, expected] of Object.entries(NON_CODATA)) {
    it(`${name} (non-CODATA theoretical constant) is ${expected}`, () => {
      expect(numericOf((F as Record<string, unknown>)[name])).toBe(expected);
    });
  }
});
