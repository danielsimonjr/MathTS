/**
 * Unit definitions for the Unit type.
 *
 * The seven SI base units, plus common derived and imperial units. Each
 * definition stores its multiplicative factor (to base SI) and dimensional
 * exponents. Temperatures carry an additive offset for the K↔°C↔°F
 * conversions.
 *
 * @module @danielsimonjr/mathts-core/types/unit-definitions
 */

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
 * Common derived units (SI named units, imperial units, and convenience units).
 *
 * This is *not* exhaustive — it covers the most common ~40 units needed for
 * dimensional-analysis tests. Add more as needed by downstream callers.
 */
export const DERIVED_UNITS: Record<string, UnitDef> = {
  // --- Length ---------------------------------------------------------------
  // Note: 'm' is a base unit (above), already prefixable.
  ft: { multiplier: 0.3048, dimensions: dim({ length: 1 }) },
  foot: { multiplier: 0.3048, dimensions: dim({ length: 1 }) },
  in: { multiplier: 0.0254, dimensions: dim({ length: 1 }) },
  inch: { multiplier: 0.0254, dimensions: dim({ length: 1 }) },
  yd: { multiplier: 0.9144, dimensions: dim({ length: 1 }) },
  yard: { multiplier: 0.9144, dimensions: dim({ length: 1 }) },
  mi: { multiplier: 1609.344, dimensions: dim({ length: 1 }) },
  mile: { multiplier: 1609.344, dimensions: dim({ length: 1 }) },

  // --- Mass -----------------------------------------------------------------
  // The "g" entry is gram (0.001 kg). It is prefixable, so kg/mg/µg work via
  // prefix application on this entry rather than the base "kg".
  g: { multiplier: 0.001, dimensions: dim({ mass: 1 }), prefixable: true },
  lb: { multiplier: 0.45359237, dimensions: dim({ mass: 1 }) },
  lbm: { multiplier: 0.45359237, dimensions: dim({ mass: 1 }) },
  oz: { multiplier: 0.028349523125, dimensions: dim({ mass: 1 }) },
  ton: { multiplier: 907.18474, dimensions: dim({ mass: 1 }) }, // US short ton
  tonne: { multiplier: 1000, dimensions: dim({ mass: 1 }) }, // metric ton

  // --- Time -----------------------------------------------------------------
  min: { multiplier: 60, dimensions: dim({ time: 1 }) },
  h: { multiplier: 3600, dimensions: dim({ time: 1 }) },
  hr: { multiplier: 3600, dimensions: dim({ time: 1 }) },
  day: { multiplier: 86400, dimensions: dim({ time: 1 }) },
  week: { multiplier: 604800, dimensions: dim({ time: 1 }) },
  year: { multiplier: 31557600, dimensions: dim({ time: 1 }) }, // Julian year

  // --- Temperature ----------------------------------------------------------
  // K is the base.
  // °C → K is offset by 273.15 (no multiplicative factor change).
  // °F → K is more complex (offset & scale).
  degC: { multiplier: 1, offset: 273.15, dimensions: dim({ temperature: 1 }) },
  degF: { multiplier: 5 / 9, offset: 459.67 * (5 / 9), dimensions: dim({ temperature: 1 }) },
  degR: { multiplier: 5 / 9, dimensions: dim({ temperature: 1 }) }, // Rankine

  // --- Plane angle (dimensionless, but often treated as units) --------------
  rad: { multiplier: 1, dimensions: dim({}), prefixable: true },
  deg: { multiplier: Math.PI / 180, dimensions: dim({}) },
  grad: { multiplier: Math.PI / 200, dimensions: dim({}) },

  // --- Force ----------------------------------------------------------------
  // N = kg·m·s^-2 = 1 kg·m·s^-2; in our base-units representation that's
  // value=1, dim {length: 1, mass: 1, time: -2}.
  N: { multiplier: 1, dimensions: dim({ length: 1, mass: 1, time: -2 }), prefixable: true },
  dyn: { multiplier: 1e-5, dimensions: dim({ length: 1, mass: 1, time: -2 }) },
  lbf: { multiplier: 4.4482216152605, dimensions: dim({ length: 1, mass: 1, time: -2 }) },

  // --- Energy ---------------------------------------------------------------
  J: { multiplier: 1, dimensions: dim({ length: 2, mass: 1, time: -2 }), prefixable: true },
  erg: { multiplier: 1e-7, dimensions: dim({ length: 2, mass: 1, time: -2 }) },
  cal: { multiplier: 4.184, dimensions: dim({ length: 2, mass: 1, time: -2 }) },
  eV: {
    multiplier: 1.602176634e-19,
    dimensions: dim({ length: 2, mass: 1, time: -2 }),
    prefixable: true,
  },
  BTU: { multiplier: 1055.05585262, dimensions: dim({ length: 2, mass: 1, time: -2 }) },

  // --- Power ----------------------------------------------------------------
  W: { multiplier: 1, dimensions: dim({ length: 2, mass: 1, time: -3 }), prefixable: true },
  hp: { multiplier: 745.6998715822702, dimensions: dim({ length: 2, mass: 1, time: -3 }) },

  // --- Pressure -------------------------------------------------------------
  Pa: { multiplier: 1, dimensions: dim({ length: -1, mass: 1, time: -2 }), prefixable: true },
  bar: { multiplier: 1e5, dimensions: dim({ length: -1, mass: 1, time: -2 }), prefixable: true },
  atm: { multiplier: 101325, dimensions: dim({ length: -1, mass: 1, time: -2 }) },
  psi: { multiplier: 6894.757293168361, dimensions: dim({ length: -1, mass: 1, time: -2 }) },
  torr: { multiplier: 133.322368421, dimensions: dim({ length: -1, mass: 1, time: -2 }) },
  mmHg: { multiplier: 133.322387415, dimensions: dim({ length: -1, mass: 1, time: -2 }) },

  // --- Electric -------------------------------------------------------------
  C: {
    multiplier: 1,
    dimensions: dim({ time: 1, current: 1 }),
    prefixable: true,
  },
  V: {
    multiplier: 1,
    dimensions: dim({ length: 2, mass: 1, time: -3, current: -1 }),
    prefixable: true,
  },
  ohm: {
    multiplier: 1,
    dimensions: dim({ length: 2, mass: 1, time: -3, current: -2 }),
    prefixable: true,
  },
  Ω: {
    multiplier: 1,
    dimensions: dim({ length: 2, mass: 1, time: -3, current: -2 }),
    prefixable: true,
  },
  F: {
    multiplier: 1,
    dimensions: dim({ length: -2, mass: -1, time: 4, current: 2 }),
    prefixable: true,
  },
  H: {
    multiplier: 1,
    dimensions: dim({ length: 2, mass: 1, time: -2, current: -2 }),
    prefixable: true,
  },

  // --- Frequency ------------------------------------------------------------
  Hz: { multiplier: 1, dimensions: dim({ time: -1 }), prefixable: true },

  // --- Volume ---------------------------------------------------------------
  L: { multiplier: 1e-3, dimensions: dim({ length: 3 }), prefixable: true },
  l: { multiplier: 1e-3, dimensions: dim({ length: 3 }), prefixable: true },
  gal: { multiplier: 0.003785411784, dimensions: dim({ length: 3 }) }, // US gallon

  // --- Area -----------------------------------------------------------------
  ha: { multiplier: 1e4, dimensions: dim({ length: 2 }) }, // hectare
  acre: { multiplier: 4046.8564224, dimensions: dim({ length: 2 }) },
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
