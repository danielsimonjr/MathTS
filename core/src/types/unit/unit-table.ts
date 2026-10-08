/**
 * The built-in unit table: one row per unit, each stating its scale to SI as an
 * exact expression, plus the aliases that copy a row under another name.
 *
 * This is the only place a built-in unit's size is written. `Unit` builds its
 * `UNITS` from these rows, the flat registry in `unit-definitions.ts` reads its
 * multipliers from them, and every row's double is the exact scale rounded
 * once (`exact-scale.ts`). A unit defined in terms of others says so
 * (`psi: 'lbf/inch^2'`, `hp: '550*foot*lbf'`), so no hand-rounded literal can
 * drift from its definition.
 *
 * Scale expressions: factors joined by `*`, optionally `/` and the
 * denominator's factors (everything after the first `/` is the denominator);
 * each factor is a decimal literal, `pi`, or a name in {@link NAMED_SCALES},
 * with an optional integer power `^n`.
 *
 * Sources: the SI Brochure (9th ed., 2019); NIST SP 811 (2008) Appendix B and
 * NIST SP 330 (2019); the International Yard and Pound Agreement (1959);
 * IAU 2012 Resolution B2 (astronomical unit) and IAU 2015 Resolution B2
 * (parsec); the Fifth International Conference on the Properties of Steam
 * (1956) for the International Table calorie.
 *
 * @module @danielsimonjr/mathts-core/types/unit/unit-table
 */

import { type ExactScale, exactScaleToNumber, readScaleExpression } from './exact-scale.js';

/** The base-dimension keys a row may name (the `BASE_UNITS` of the Unit class). */
export type UnitBaseKey =
  | 'MASS'
  | 'LENGTH'
  | 'TIME'
  | 'CURRENT'
  | 'TEMPERATURE'
  | 'LUMINOUS_INTENSITY'
  | 'AMOUNT_OF_SUBSTANCE'
  | 'FORCE'
  | 'SURFACE'
  | 'VOLUME'
  | 'ENERGY'
  | 'POWER'
  | 'PRESSURE'
  | 'ELECTRIC_CHARGE'
  | 'ELECTRIC_CAPACITANCE'
  | 'ELECTRIC_POTENTIAL'
  | 'ELECTRIC_RESISTANCE'
  | 'ELECTRIC_INDUCTANCE'
  | 'ELECTRIC_CONDUCTANCE'
  | 'MAGNETIC_FLUX'
  | 'MAGNETIC_FLUX_DENSITY'
  | 'FREQUENCY'
  | 'ANGLE'
  | 'BIT'
  | 'SOLID_ANGLE';

/** The prefix-set keys a row may name (the `PREFIXES` of the Unit class). */
export type UnitPrefixSetKey =
  | 'NONE'
  | 'SHORT'
  | 'LONG'
  | 'SHORTLONG'
  | 'SQUARED'
  | 'CUBIC'
  | 'BINARY_SHORT'
  | 'BINARY_LONG'
  | 'BTU'
  | 'SHORT_UP_ONLY';

/** One built-in unit. */
export interface UnitRow {
  /** The base dimension. */
  readonly base: UnitBaseKey;
  /** The prefixes the unit takes. */
  readonly prefixes: UnitPrefixSetKey;
  /** The exact scale to SI, as a scale expression. */
  readonly scale: string;
  /** Additive offset in the unit's own degrees, for an affine scale: SI = (x + offset) × scale. */
  readonly offset?: string;
  /** The unit's display name, when it differs from its key. */
  readonly name?: string;
  /** Prefer this unit in the reciprocal of its base (Hz for 1/s). */
  readonly reciprocal?: true;
  /** The value is the imaginary unit times the scale (reactive power, VAR). */
  readonly imaginary?: true;
}

/**
 * Named exact scales the rows share. Each is a defining value or follows from
 * named ones, so a derived unit cites its definition instead of a decimal.
 */
export const NAMED_SCALES: Readonly<Record<string, string>> = Object.freeze({
  /** International inch, International Yard and Pound Agreement (1959). */
  inch: '0.0254',
  foot: '12*inch',
  yard: '3*foot',
  mile: '5280*foot',
  /** International avoirdupois pound, International Yard and Pound Agreement (1959). */
  pound: '0.45359237',
  /** Standard acceleration of gravity, 3rd CGPM (1901). */
  standard_gravity: '9.80665',
  /** Pound-force: one pound times standard gravity. */
  lbf: 'pound*standard_gravity',
  /** US gallon: 231 cubic inches. */
  us_gallon: '231*inch^3',
  us_fluid_ounce: 'us_gallon/128',
  /** Julian year, 365.25 days (IAU). */
  julian_year: '365.25*86400',
  /** Speed of light in vacuum, exact in the SI. */
  speed_of_light: '299792458',
  /** Astronomical unit, IAU 2012 Resolution B2. */
  astronomical_unit: '149597870700',
  /** Standard atmosphere, 10th CGPM (1954). */
  standard_atmosphere: '101325',
  /** International Table calorie (1956). */
  calorie_IT: '4.1868',
});

/** The built-in units, keyed by the name a unit text spells. */
export const UNIT_ROWS: Readonly<Record<string, UnitRow>> = Object.freeze({
  meter: { base: 'LENGTH', prefixes: 'LONG', scale: '1' },
  inch: { base: 'LENGTH', prefixes: 'NONE', scale: 'inch' },
  foot: { base: 'LENGTH', prefixes: 'NONE', scale: 'foot' },
  yard: { base: 'LENGTH', prefixes: 'NONE', scale: 'yard' },
  mile: { base: 'LENGTH', prefixes: 'NONE', scale: 'mile' },
  link: { base: 'LENGTH', prefixes: 'NONE', scale: '0.66*foot' }, // Gunter link, 0.66 ft (international foot)
  rod: { base: 'LENGTH', prefixes: 'NONE', scale: '16.5*foot' }, // 16.5 ft (international foot)
  chain: { base: 'LENGTH', prefixes: 'NONE', scale: '66*foot' }, // 66 ft (international foot)
  angstrom: { base: 'LENGTH', prefixes: 'NONE', scale: '1e-10' },
  astronomicalUnit: { base: 'LENGTH', prefixes: 'NONE', scale: 'astronomical_unit' }, // IAU 2012 Resolution B2
  lightyear: { base: 'LENGTH', prefixes: 'NONE', scale: 'speed_of_light*julian_year' }, // c × Julian year (IAU)
  ly: { base: 'LENGTH', prefixes: 'SHORT_UP_ONLY', scale: 'speed_of_light*julian_year' }, // c × Julian year (IAU)
  parsec: { base: 'LENGTH', prefixes: 'LONG', scale: '648000*astronomical_unit/pi' }, // IAU 2015 Resolution B2: 648000/π au
  pc: { base: 'LENGTH', prefixes: 'SHORT_UP_ONLY', scale: '648000*astronomical_unit/pi' }, // IAU 2015 Resolution B2: 648000/π au
  nauticalMile: { base: 'LENGTH', prefixes: 'NONE', scale: '1852' },
  fathom: { base: 'LENGTH', prefixes: 'NONE', scale: '6*foot' }, // 6 ft
  furlong: { base: 'LENGTH', prefixes: 'NONE', scale: '660*foot' }, // 660 ft (1/8 mile)
  point: { base: 'LENGTH', prefixes: 'NONE', scale: 'inch/72' }, // 1/72 inch (PostScript point)
  pica: { base: 'LENGTH', prefixes: 'NONE', scale: 'inch/6' }, // 12 points = 1/6 inch
  m: { base: 'LENGTH', prefixes: 'SHORT', scale: '1' },
  in: { base: 'LENGTH', prefixes: 'NONE', scale: 'inch' },
  ft: { base: 'LENGTH', prefixes: 'NONE', scale: 'foot' },
  yd: { base: 'LENGTH', prefixes: 'NONE', scale: 'yard' },
  mi: { base: 'LENGTH', prefixes: 'NONE', scale: 'mile' },
  li: { base: 'LENGTH', prefixes: 'NONE', scale: '0.66*foot' },
  rd: { base: 'LENGTH', prefixes: 'NONE', scale: '16.5*foot' }, // 16.5 ft (international foot)
  ch: { base: 'LENGTH', prefixes: 'NONE', scale: '66*foot' }, // 66 ft
  mil: { base: 'LENGTH', prefixes: 'NONE', scale: '0.001*inch' }, // 1/1000 inch
  m2: { base: 'SURFACE', prefixes: 'SQUARED', scale: '1' },
  sqin: { base: 'SURFACE', prefixes: 'NONE', scale: 'inch^2' },
  sqft: { base: 'SURFACE', prefixes: 'NONE', scale: 'foot^2' },
  sqyd: { base: 'SURFACE', prefixes: 'NONE', scale: 'yard^2' },
  sqmi: { base: 'SURFACE', prefixes: 'NONE', scale: 'mile^2' },
  sqrd: { base: 'SURFACE', prefixes: 'NONE', scale: '272.25*foot^2' }, // (16.5 ft)^2
  sqch: { base: 'SURFACE', prefixes: 'NONE', scale: '4356*foot^2' }, // (66 ft)^2
  sqmil: { base: 'SURFACE', prefixes: 'NONE', scale: '1e-6*inch^2' },
  acre: { base: 'SURFACE', prefixes: 'NONE', scale: '43560*foot^2' }, // 43 560 ft^2 (international acre)
  hectare: { base: 'SURFACE', prefixes: 'NONE', scale: '1e4' },
  m3: { base: 'VOLUME', prefixes: 'CUBIC', scale: '1' },
  L: { base: 'VOLUME', prefixes: 'SHORT', scale: '1e-3' },
  l: { base: 'VOLUME', prefixes: 'SHORT', scale: '1e-3' },
  litre: { base: 'VOLUME', prefixes: 'LONG', scale: '1e-3' },
  cuin: { base: 'VOLUME', prefixes: 'NONE', scale: 'inch^3' },
  cuft: { base: 'VOLUME', prefixes: 'NONE', scale: 'foot^3' },
  cuyd: { base: 'VOLUME', prefixes: 'NONE', scale: 'yard^3' },
  teaspoon: { base: 'VOLUME', prefixes: 'NONE', scale: '5e-6' }, // metric teaspoon, 5 mL (not the US customary 4.93 mL)
  tablespoon: { base: 'VOLUME', prefixes: 'NONE', scale: '15e-6' }, // metric tablespoon, 15 mL (not the US customary 14.79 mL)
  drop: { base: 'VOLUME', prefixes: 'NONE', scale: '5e-8' }, // 0.05 mL (medical convention)
  gtt: { base: 'VOLUME', prefixes: 'NONE', scale: '5e-8' }, // 0.05 mL (medical convention)
  minim: { base: 'VOLUME', prefixes: 'NONE', scale: 'us_fluid_ounce/480' }, // 1/480 US fl oz
  fluiddram: { base: 'VOLUME', prefixes: 'NONE', scale: 'us_fluid_ounce/8' }, // 1/8 US fl oz
  fluidounce: { base: 'VOLUME', prefixes: 'NONE', scale: 'us_fluid_ounce' },
  gill: { base: 'VOLUME', prefixes: 'NONE', scale: '4*us_fluid_ounce' }, // 4 US fl oz
  cc: { base: 'VOLUME', prefixes: 'NONE', scale: '1e-6' },
  cup: { base: 'VOLUME', prefixes: 'NONE', scale: '8*us_fluid_ounce' }, // US customary cup, 8 US fl oz
  pint: { base: 'VOLUME', prefixes: 'NONE', scale: '16*us_fluid_ounce' }, // US liquid pint
  quart: { base: 'VOLUME', prefixes: 'NONE', scale: '32*us_fluid_ounce' }, // US liquid quart
  gallon: { base: 'VOLUME', prefixes: 'NONE', scale: 'us_gallon' }, // US gallon, 231 in^3
  beerbarrel: { base: 'VOLUME', prefixes: 'NONE', scale: '31*us_gallon' }, // 31 US gal
  oilbarrel: { base: 'VOLUME', prefixes: 'NONE', scale: '42*us_gallon' }, // 42 US gal
  hogshead: { base: 'VOLUME', prefixes: 'NONE', scale: '63*us_gallon' }, // 63 US gal
  g: { base: 'MASS', prefixes: 'SHORT', scale: '1e-3' },
  gram: { base: 'MASS', prefixes: 'LONG', scale: '1e-3' },
  ton: { base: 'MASS', prefixes: 'SHORT', scale: '2000*pound' }, // US short ton, 2000 lb
  t: { base: 'MASS', prefixes: 'SHORT', scale: '1000' },
  tonne: { base: 'MASS', prefixes: 'LONG', scale: '1000' },
  grain: { base: 'MASS', prefixes: 'NONE', scale: 'pound/7000' }, // 1/7000 lb
  dram: { base: 'MASS', prefixes: 'NONE', scale: 'pound/256' }, // avoirdupois dram, 1/256 lb
  ounce: { base: 'MASS', prefixes: 'NONE', scale: 'pound/16' }, // avoirdupois ounce
  poundmass: { base: 'MASS', prefixes: 'NONE', scale: 'pound' },
  hundredweight: { base: 'MASS', prefixes: 'NONE', scale: '100*pound' }, // US short hundredweight, 100 lb
  stick: { base: 'MASS', prefixes: 'NONE', scale: '0.115' }, // butter stick (as in mathjs)
  stone: { base: 'MASS', prefixes: 'NONE', scale: '14*pound' }, // 14 lb
  gr: { base: 'MASS', prefixes: 'NONE', scale: 'pound/7000' },
  dr: { base: 'MASS', prefixes: 'NONE', scale: 'pound/256' },
  oz: { base: 'MASS', prefixes: 'NONE', scale: 'pound/16' },
  lbm: { base: 'MASS', prefixes: 'NONE', scale: 'pound' },
  cwt: { base: 'MASS', prefixes: 'NONE', scale: '100*pound' },
  s: { base: 'TIME', prefixes: 'SHORT', scale: '1' },
  min: { base: 'TIME', prefixes: 'NONE', scale: '60' },
  h: { base: 'TIME', prefixes: 'NONE', scale: '3600' },
  second: { base: 'TIME', prefixes: 'LONG', scale: '1' },
  sec: { base: 'TIME', prefixes: 'LONG', scale: '1' },
  minute: { base: 'TIME', prefixes: 'NONE', scale: '60' },
  hour: { base: 'TIME', prefixes: 'NONE', scale: '3600' },
  day: { base: 'TIME', prefixes: 'NONE', scale: '86400' },
  week: { base: 'TIME', prefixes: 'NONE', scale: '7*86400' },
  month: { base: 'TIME', prefixes: 'NONE', scale: 'julian_year/12' }, // 1/12 Julian year
  year: { base: 'TIME', prefixes: 'NONE', scale: 'julian_year' }, // Julian year
  decade: { base: 'TIME', prefixes: 'NONE', scale: '10*julian_year' }, // 10 Julian years
  century: { base: 'TIME', prefixes: 'NONE', scale: '100*julian_year' }, // 100 Julian years
  millennium: { base: 'TIME', prefixes: 'NONE', scale: '1000*julian_year' }, // 1000 Julian years
  hertz: { base: 'FREQUENCY', prefixes: 'LONG', scale: '1', name: 'Hertz', reciprocal: true },
  Hz: { base: 'FREQUENCY', prefixes: 'SHORT', scale: '1', reciprocal: true },
  rad: { base: 'ANGLE', prefixes: 'SHORT', scale: '1' },
  radian: { base: 'ANGLE', prefixes: 'LONG', scale: '1' },
  deg: { base: 'ANGLE', prefixes: 'SHORT', scale: 'pi/180' },
  degree: { base: 'ANGLE', prefixes: 'LONG', scale: 'pi/180' },
  grad: { base: 'ANGLE', prefixes: 'SHORT', scale: 'pi/200' },
  gradian: { base: 'ANGLE', prefixes: 'LONG', scale: 'pi/200' },
  cycle: { base: 'ANGLE', prefixes: 'NONE', scale: '2*pi' }, // one turn, 2π rad
  arcsec: { base: 'ANGLE', prefixes: 'NONE', scale: 'pi/648000' },
  arcmin: { base: 'ANGLE', prefixes: 'NONE', scale: 'pi/10800' },
  A: { base: 'CURRENT', prefixes: 'SHORT', scale: '1' },
  ampere: { base: 'CURRENT', prefixes: 'LONG', scale: '1' },
  K: { base: 'TEMPERATURE', prefixes: 'SHORT', scale: '1' },
  degC: { base: 'TEMPERATURE', prefixes: 'SHORT', scale: '1', offset: '273.15' }, // K = °C + 273.15
  degF: { base: 'TEMPERATURE', prefixes: 'SHORT', scale: '5/9', offset: '459.67' }, // K = (°F + 459.67) × 5/9
  degR: { base: 'TEMPERATURE', prefixes: 'SHORT', scale: '5/9' }, // K = °R × 5/9
  kelvin: { base: 'TEMPERATURE', prefixes: 'LONG', scale: '1' },
  celsius: { base: 'TEMPERATURE', prefixes: 'LONG', scale: '1', offset: '273.15' },
  fahrenheit: { base: 'TEMPERATURE', prefixes: 'LONG', scale: '5/9', offset: '459.67' },
  rankine: { base: 'TEMPERATURE', prefixes: 'LONG', scale: '5/9' },
  mol: { base: 'AMOUNT_OF_SUBSTANCE', prefixes: 'SHORT', scale: '1' },
  mole: { base: 'AMOUNT_OF_SUBSTANCE', prefixes: 'LONG', scale: '1' },
  cd: { base: 'LUMINOUS_INTENSITY', prefixes: 'SHORT', scale: '1' },
  candela: { base: 'LUMINOUS_INTENSITY', prefixes: 'LONG', scale: '1' },
  sr: { base: 'SOLID_ANGLE', prefixes: 'NONE', scale: '1' },
  steradian: { base: 'SOLID_ANGLE', prefixes: 'LONG', scale: '1' },
  N: { base: 'FORCE', prefixes: 'SHORT', scale: '1' },
  newton: { base: 'FORCE', prefixes: 'LONG', scale: '1' },
  dyn: { base: 'FORCE', prefixes: 'SHORT', scale: '1e-5' },
  dyne: { base: 'FORCE', prefixes: 'LONG', scale: '1e-5' },
  lbf: { base: 'FORCE', prefixes: 'NONE', scale: 'lbf' },
  poundforce: { base: 'FORCE', prefixes: 'NONE', scale: 'lbf' },
  kip: { base: 'FORCE', prefixes: 'LONG', scale: '1000*lbf' }, // 1000 lbf
  kilogramforce: { base: 'FORCE', prefixes: 'NONE', scale: 'standard_gravity' }, // standard gravity × 1 kg
  J: { base: 'ENERGY', prefixes: 'SHORT', scale: '1' },
  joule: { base: 'ENERGY', prefixes: 'LONG', scale: '1' },
  erg: { base: 'ENERGY', prefixes: 'SHORTLONG', scale: '1e-7' },
  Wh: { base: 'ENERGY', prefixes: 'SHORT', scale: '3600' },
  cal: { base: 'ENERGY', prefixes: 'SHORT', scale: '4.184' }, // thermochemical calorie, 4.184 J exactly (NIST SP 811). Not cal_IT = 4.1868 J
  calorie: { base: 'ENERGY', prefixes: 'LONG', scale: '4.184' }, // thermochemical calorie
  BTU: { base: 'ENERGY', prefixes: 'BTU', scale: '1000*calorie_IT*pound/1.8' }, // International Table BTU: cal_IT × (lb/g) / 1.8
  eV: { base: 'ENERGY', prefixes: 'SHORT', scale: '1.602176634e-19' }, // e × 1 V, exact since the 2019 SI
  electronvolt: { base: 'ENERGY', prefixes: 'LONG', scale: '1.602176634e-19' },
  W: { base: 'POWER', prefixes: 'SHORT', scale: '1' },
  watt: { base: 'POWER', prefixes: 'LONG', scale: '1' },
  hp: { base: 'POWER', prefixes: 'NONE', scale: '550*foot*lbf' }, // mechanical horsepower, 550 ft·lbf/s
  VAR: { base: 'POWER', prefixes: 'SHORT', scale: '1', imaginary: true }, // reactive power: the value is the imaginary unit times this scale
  VA: { base: 'POWER', prefixes: 'SHORT', scale: '1' },
  Pa: { base: 'PRESSURE', prefixes: 'SHORT', scale: '1' },
  psi: { base: 'PRESSURE', prefixes: 'NONE', scale: 'lbf/inch^2' }, // lbf/in^2
  atm: { base: 'PRESSURE', prefixes: 'NONE', scale: 'standard_atmosphere' }, // standard atmosphere
  bar: { base: 'PRESSURE', prefixes: 'SHORTLONG', scale: '1e5' },
  torr: { base: 'PRESSURE', prefixes: 'NONE', scale: 'standard_atmosphere/760' }, // 1/760 atm (exact)
  mmHg: { base: 'PRESSURE', prefixes: 'NONE', scale: '13.5951*standard_gravity' }, // conventional mmHg: 13.5951 g/cm^3 × g_n × 1 mm = 133.322387415 Pa (NIST SP 811). Not the torr
  mmH2O: { base: 'PRESSURE', prefixes: 'NONE', scale: 'standard_gravity' }, // conventional: 1000 kg/m^3 × g_n × 1 mm
  cmH2O: { base: 'PRESSURE', prefixes: 'NONE', scale: '10*standard_gravity' }, // conventional: 1000 kg/m^3 × g_n × 1 cm
  coulomb: { base: 'ELECTRIC_CHARGE', prefixes: 'LONG', scale: '1' },
  C: { base: 'ELECTRIC_CHARGE', prefixes: 'SHORT', scale: '1' },
  farad: { base: 'ELECTRIC_CAPACITANCE', prefixes: 'LONG', scale: '1' },
  F: { base: 'ELECTRIC_CAPACITANCE', prefixes: 'SHORT', scale: '1' },
  volt: { base: 'ELECTRIC_POTENTIAL', prefixes: 'LONG', scale: '1' },
  V: { base: 'ELECTRIC_POTENTIAL', prefixes: 'SHORT', scale: '1' },
  ohm: { base: 'ELECTRIC_RESISTANCE', prefixes: 'SHORTLONG', scale: '1' },
  henry: { base: 'ELECTRIC_INDUCTANCE', prefixes: 'LONG', scale: '1' },
  H: { base: 'ELECTRIC_INDUCTANCE', prefixes: 'SHORT', scale: '1' },
  siemens: { base: 'ELECTRIC_CONDUCTANCE', prefixes: 'LONG', scale: '1' },
  S: { base: 'ELECTRIC_CONDUCTANCE', prefixes: 'SHORT', scale: '1' },
  weber: { base: 'MAGNETIC_FLUX', prefixes: 'LONG', scale: '1' },
  Wb: { base: 'MAGNETIC_FLUX', prefixes: 'SHORT', scale: '1' },
  tesla: { base: 'MAGNETIC_FLUX_DENSITY', prefixes: 'LONG', scale: '1' },
  T: { base: 'MAGNETIC_FLUX_DENSITY', prefixes: 'SHORT', scale: '1' },
  b: { base: 'BIT', prefixes: 'BINARY_SHORT', scale: '1' }, // bit: its own BIT dimension (storage), not ln 2 nat
  bits: { base: 'BIT', prefixes: 'BINARY_LONG', scale: '1' },
  B: { base: 'BIT', prefixes: 'BINARY_SHORT', scale: '8' }, // byte, 8 bits
  bytes: { base: 'BIT', prefixes: 'BINARY_LONG', scale: '8' },
});

/**
 * Further spellings of a row (plurals, long names, symbols). Each copies the
 * row it names, so it has that row's scale, dimension and prefixes.
 */
export const UNIT_ROW_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  meters: 'meter',
  // Astronomical / nautical / typography aliases (B-5 port). Lowercase
  // 'au' is deliberately ABSENT: it collides with the atomic unit of
  // length (Bohr radius, ~5.29e-11 m), 21 orders of magnitude smaller.
  AU: 'astronomicalUnit',
  astronomicalUnits: 'astronomicalUnit',
  lightyears: 'lightyear',
  parsecs: 'parsec',
  nmi: 'nauticalMile',
  nauticalMiles: 'nauticalMile',
  fathoms: 'fathom',
  furlongs: 'furlong',
  points: 'point',
  picas: 'pica',
  inches: 'inch',
  feet: 'foot',
  yards: 'yard',
  miles: 'mile',
  links: 'link',
  rods: 'rod',
  chains: 'chain',
  angstroms: 'angstrom',

  lt: 'l',
  litres: 'litre',
  liter: 'litre',
  liters: 'litre',
  teaspoons: 'teaspoon',
  tablespoons: 'tablespoon',
  minims: 'minim',
  fldr: 'fluiddram',
  fluiddrams: 'fluiddram',
  floz: 'fluidounce',
  fluidounces: 'fluidounce',
  gi: 'gill',
  gills: 'gill',
  cp: 'cup',
  cups: 'cup',
  pt: 'pint',
  pints: 'pint',
  qt: 'quart',
  quarts: 'quart',
  gal: 'gallon',
  gallons: 'gallon',
  bbl: 'beerbarrel',
  beerbarrels: 'beerbarrel',
  obl: 'oilbarrel',
  oilbarrels: 'oilbarrel',
  hogsheads: 'hogshead',
  gtts: 'gtt',

  grams: 'gram',
  tons: 'ton',
  tonnes: 'tonne',
  grains: 'grain',
  drams: 'dram',
  ounces: 'ounce',
  poundmasses: 'poundmass',
  hundredweights: 'hundredweight',
  sticks: 'stick',
  lb: 'lbm',
  lbs: 'lbm',

  kips: 'kip',
  kgf: 'kilogramforce',

  acres: 'acre',
  hectares: 'hectare',
  sqfeet: 'sqft',
  sqyard: 'sqyd',
  sqmile: 'sqmi',
  sqmiles: 'sqmi',

  mmhg: 'mmHg',
  mmh2o: 'mmH2O',
  cmh2o: 'cmH2O',

  seconds: 'second',
  secs: 'second',
  minutes: 'minute',
  mins: 'minute',
  hours: 'hour',
  hr: 'hour',
  hrs: 'hour',
  days: 'day',
  weeks: 'week',
  months: 'month',
  years: 'year',
  decades: 'decade',
  centuries: 'century',
  millennia: 'millennium',

  hertz: 'hertz',

  radians: 'radian',
  degrees: 'degree',
  gradians: 'gradian',
  cycles: 'cycle',
  arcsecond: 'arcsec',
  arcseconds: 'arcsec',
  arcminute: 'arcmin',
  arcminutes: 'arcmin',

  BTUs: 'BTU',
  watts: 'watt',
  joules: 'joule',

  amperes: 'ampere',
  amps: 'ampere',
  amp: 'ampere',
  coulombs: 'coulomb',
  volts: 'volt',
  ohms: 'ohm',
  farads: 'farad',
  webers: 'weber',
  teslas: 'tesla',
  electronvolts: 'electronvolt',
  moles: 'mole',

  bit: 'bits',
  byte: 'bytes',
  calories: 'calorie',
});

const namedCache = new Map<string, ExactScale>();

/** The exact value of a name in {@link NAMED_SCALES}, or undefined for an unknown name. */
export function namedExactScale(name: string): ExactScale | undefined {
  const cached = namedCache.get(name);
  if (cached !== undefined) return cached;
  if (!Object.prototype.hasOwnProperty.call(NAMED_SCALES, name)) return undefined;
  const scale = readScaleExpression(NAMED_SCALES[name]!, namedExactScale);
  namedCache.set(name, scale);
  return scale;
}

/** The exact value of a scale expression over {@link NAMED_SCALES}. */
export function readUnitScale(expression: string): ExactScale {
  return readScaleExpression(expression, namedExactScale);
}

/** The table row a built-in name or alias spells, or undefined. */
export function getUnitRow(name: string): UnitRow | undefined {
  const own = Object.prototype.hasOwnProperty;
  if (own.call(UNIT_ROWS, name)) return UNIT_ROWS[name];
  if (own.call(UNIT_ROW_ALIASES, name)) return UNIT_ROWS[UNIT_ROW_ALIASES[name]!];
  return undefined;
}

/** The exact scale of a built-in unit name or alias (no prefix), or undefined. */
export function unitRowExactScale(name: string): ExactScale | undefined {
  const row = getUnitRow(name);
  return row === undefined ? undefined : readUnitScale(row.scale);
}

/** The double a built-in unit's scale rounds to, or undefined for an unknown name. */
export function unitRowValue(name: string): number | undefined {
  const scale = unitRowExactScale(name);
  return scale === undefined ? undefined : exactScaleToNumber(scale);
}
