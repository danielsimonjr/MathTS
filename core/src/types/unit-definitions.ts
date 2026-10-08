/**
 * Unit definitions for the Unit type.
 *
 * The seven SI base units, plus common derived and imperial units. Each
 * definition stores its multiplicative factor (to base SI) and dimensional
 * exponents. Temperatures carry an additive offset for the K↔°C↔°F
 * conversions.
 *
 * The factors and offsets are not written here: each derived entry reads the
 * row of the one built-in unit table (`unit/unit-table.ts`) that `Unit` also
 * builds from, so this flat registry and `Unit` cannot disagree.
 *
 * @module @danielsimonjr/mathts-core/types/unit-definitions
 */

import { exactScaleToNumber, multiplyExactScales } from './unit/exact-scale.js';
import { getUnitRow, readUnitScale } from './unit/unit-table.js';

/**
 * The seven SI base dimensions, expressed as a vector of (possibly fractional)
 * exponents.
 */
export interface Dimensions {
  /** Length, base unit metre */
  length: number;
  /** Mass, base unit kilogram */
  mass: number;
  /** Time, base unit second */
  time: number;
  /** Electric current, base unit ampere */
  current: number;
  /** Thermodynamic temperature, base unit kelvin */
  temperature: number;
  /** Amount of substance, base unit mole */
  amount: number;
  /** Luminous intensity, base unit candela */
  luminosity: number;
}

/**
 * The zero-dimensional vector (a dimensionless quantity).
 */
export const DIMENSIONLESS: Dimensions = Object.freeze({
  length: 0,
  mass: 0,
  time: 0,
  current: 0,
  temperature: 0,
  amount: 0,
  luminosity: 0,
});

/**
 * Construct a Dimensions record from a partial spec.
 *
 * Missing fields default to 0, so `dim({ length: 1 })` returns the dimension
 * vector for length.
 */
export function dim(partial: Partial<Dimensions>): Dimensions {
  return {
    length: partial.length ?? 0,
    mass: partial.mass ?? 0,
    time: partial.time ?? 0,
    current: partial.current ?? 0,
    temperature: partial.temperature ?? 0,
    amount: partial.amount ?? 0,
    luminosity: partial.luminosity ?? 0,
  };
}

/**
 * Definition of a single named unit.
 */
export interface UnitDef {
  /** Multiplicative factor: value-in-base = input * multiplier (+ offset). */
  multiplier: number;
  /** Additive offset, used for non-multiplicative units like °C and °F. */
  offset?: number;
  /** Dimensional signature. */
  dimensions: Dimensions;
  /** Whether SI prefixes (k, M, µ, …) may be applied to this notation. */
  prefixable?: boolean;
}

/**
 * The seven SI base units.
 */
export const BASE_UNITS: Record<string, UnitDef> = {
  m: { multiplier: 1, dimensions: dim({ length: 1 }), prefixable: true },
  // The base unit of mass is *kilogram*, but the prefix-able symbol is "g".
  // Internally we treat 1 kg as the canonical value, so "g" -> 0.001 kg.
  kg: { multiplier: 1, dimensions: dim({ mass: 1 }) },
  s: { multiplier: 1, dimensions: dim({ time: 1 }), prefixable: true },
  A: { multiplier: 1, dimensions: dim({ current: 1 }), prefixable: true },
  K: { multiplier: 1, dimensions: dim({ temperature: 1 }), prefixable: true },
  mol: { multiplier: 1, dimensions: dim({ amount: 1 }), prefixable: true },
  cd: { multiplier: 1, dimensions: dim({ luminosity: 1 }), prefixable: true },
};

/**
 * A registry entry for the unit-table row `name`: its multiplier is the row's
 * exact scale rounded once, and an affine row's offset is stated in kelvin
 * (the row's offset times its scale), as {@link UnitDef.offset} reads.
 */
function tableUnit(name: string, dimensions: Dimensions, prefixable?: boolean): UnitDef {
  const row = getUnitRow(name);
  if (row === undefined) throw new Error(`unit-definitions: '${name}' is not in the unit table`);
  const scale = readUnitScale(row.scale);
  const def: UnitDef = { multiplier: exactScaleToNumber(scale), dimensions };
  if (row.offset !== undefined) {
    def.offset = exactScaleToNumber(multiplyExactScales(scale, readUnitScale(row.offset)));
  }
  if (prefixable) def.prefixable = true;
  return def;
}

/**
 * Common derived units (SI named units, imperial units, and convenience units).
 *
 * This is *not* exhaustive — it covers the most common ~40 units needed for
 * dimensional-analysis tests. Add more as needed by downstream callers.
 */
export const DERIVED_UNITS: Record<string, UnitDef> = {
  // --- Length ---------------------------------------------------------------
  // Note: 'm' is a base unit (above), already prefixable.
  ft: tableUnit('ft', dim({ length: 1 })),
  foot: tableUnit('foot', dim({ length: 1 })),
  in: tableUnit('in', dim({ length: 1 })),
  inch: tableUnit('inch', dim({ length: 1 })),
  yd: tableUnit('yd', dim({ length: 1 })),
  yard: tableUnit('yard', dim({ length: 1 })),
  mi: tableUnit('mi', dim({ length: 1 })),
  mile: tableUnit('mile', dim({ length: 1 })),

  // --- Mass -----------------------------------------------------------------
  // The "g" entry is gram (0.001 kg). It is prefixable, so kg/mg/µg work via
  // prefix application on this entry rather than the base "kg".
  g: tableUnit('g', dim({ mass: 1 }), true),
  lb: tableUnit('lb', dim({ mass: 1 })),
  lbm: tableUnit('lbm', dim({ mass: 1 })),
  oz: tableUnit('oz', dim({ mass: 1 })),
  ton: tableUnit('ton', dim({ mass: 1 })), // US short ton
  tonne: tableUnit('tonne', dim({ mass: 1 })), // metric ton

  // --- Time -----------------------------------------------------------------
  min: tableUnit('min', dim({ time: 1 })),
  h: tableUnit('h', dim({ time: 1 })),
  hr: tableUnit('hr', dim({ time: 1 })),
  day: tableUnit('day', dim({ time: 1 })),
  week: tableUnit('week', dim({ time: 1 })),
  year: tableUnit('year', dim({ time: 1 })), // Julian year

  // --- Temperature ----------------------------------------------------------
  // K is the base.
  // °C → K is offset by 273.15 (no multiplicative factor change).
  // °F → K is more complex (offset & scale).
  degC: tableUnit('degC', dim({ temperature: 1 })),
  degF: tableUnit('degF', dim({ temperature: 1 })),
  degR: tableUnit('degR', dim({ temperature: 1 })), // Rankine

  // --- Plane angle (dimensionless, but often treated as units) --------------
  rad: tableUnit('rad', dim({}), true),
  deg: tableUnit('deg', dim({})),
  grad: tableUnit('grad', dim({})),

  // --- Force ----------------------------------------------------------------
  // N = kg·m·s^-2 = 1 kg·m·s^-2; in our base-units representation that's
  // value=1, dim {length: 1, mass: 1, time: -2}.
  N: tableUnit('N', dim({ length: 1, mass: 1, time: -2 }), true),
  dyn: tableUnit('dyn', dim({ length: 1, mass: 1, time: -2 })),
  lbf: tableUnit('lbf', dim({ length: 1, mass: 1, time: -2 })),

  // --- Energy ---------------------------------------------------------------
  J: tableUnit('J', dim({ length: 2, mass: 1, time: -2 }), true),
  erg: tableUnit('erg', dim({ length: 2, mass: 1, time: -2 })),
  cal: tableUnit('cal', dim({ length: 2, mass: 1, time: -2 })),
  eV: tableUnit('eV', dim({ length: 2, mass: 1, time: -2 }), true),
  BTU: tableUnit('BTU', dim({ length: 2, mass: 1, time: -2 })),

  // --- Power ----------------------------------------------------------------
  W: tableUnit('W', dim({ length: 2, mass: 1, time: -3 }), true),
  hp: tableUnit('hp', dim({ length: 2, mass: 1, time: -3 })),

  // --- Pressure -------------------------------------------------------------
  Pa: tableUnit('Pa', dim({ length: -1, mass: 1, time: -2 }), true),
  bar: tableUnit('bar', dim({ length: -1, mass: 1, time: -2 }), true),
  atm: tableUnit('atm', dim({ length: -1, mass: 1, time: -2 })),
  psi: tableUnit('psi', dim({ length: -1, mass: 1, time: -2 })),
  torr: tableUnit('torr', dim({ length: -1, mass: 1, time: -2 })),
  mmHg: tableUnit('mmHg', dim({ length: -1, mass: 1, time: -2 })),

  // --- Electric -------------------------------------------------------------
  C: tableUnit('C', dim({ time: 1, current: 1 }), true),
  V: tableUnit('V', dim({ length: 2, mass: 1, time: -3, current: -1 }), true),
  ohm: tableUnit('ohm', dim({ length: 2, mass: 1, time: -3, current: -2 }), true),
  Ω: tableUnit('ohm', dim({ length: 2, mass: 1, time: -3, current: -2 }), true),
  F: tableUnit('F', dim({ length: -2, mass: -1, time: 4, current: 2 }), true),
  H: tableUnit('H', dim({ length: 2, mass: 1, time: -2, current: -2 }), true),

  // --- Frequency ------------------------------------------------------------
  Hz: tableUnit('Hz', dim({ time: -1 }), true),

  // --- Volume ---------------------------------------------------------------
  L: tableUnit('L', dim({ length: 3 }), true),
  l: tableUnit('l', dim({ length: 3 }), true),
  gal: tableUnit('gal', dim({ length: 3 })), // US gallon

  // --- Area -----------------------------------------------------------------
  ha: tableUnit('hectare', dim({ length: 2 })), // hectare
  acre: tableUnit('acre', dim({ length: 2 })),
};

/**
 * Combined registry — both base and derived units in one map.
 */
export const ALL_UNITS: Record<string, UnitDef> = { ...BASE_UNITS, ...DERIVED_UNITS };

/**
 * Convenience aliases mapping common Unicode/ASCII variants to the canonical
 * notation key. Used by the parser; not part of the registered notation set.
 */
export const UNIT_ALIASES: Record<string, string> = {
  '°C': 'degC',
  '°F': 'degF',
  '°R': 'degR',
  '°': 'deg',
  // The Unicode micro sign is handled in prefixes; °K is non-standard.
};

/**
 * Lookup an exact (non-prefixed) unit definition.
 */
export function getUnitDef(name: string): UnitDef | undefined {
  return ALL_UNITS[name];
}
