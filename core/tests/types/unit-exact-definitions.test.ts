/**
 * Every built-in unit against an independent list of exact definitions.
 *
 * The list below is written from the primary sources (SI Brochure 2019, NIST
 * SP 811 Appendix B, NIST SP 330, the 1959 International Yard and Pound
 * Agreement, IAU 2012 B2 and IAU 2015 B2), with its own bigint rationals, its
 * own π digits and its own base-2 rounding. It does not read the unit table's
 * scale expressions or the exact-scale engine, so a table row that drifts from
 * its definition, or an engine rounding bug, fails here.
 *
 * Coverage runs both ways: a built-in name missing from this list fails, and a
 * name here that the table does not define fails.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/types/unit';
import { Fraction } from '../../src/types/fraction';
import { BigNumber } from '../../src/types/bignumber';
import {
  ALL_UNITS,
  UNIT_ROWS,
  UNIT_ROW_ALIASES,
  binaryExactScale,
  decimalExactScale,
  exactScaleOf,
  exactScaleToNumber,
  ratioExactScale,
  readScaleExpression,
  unitRowExactScale,
} from '../../src/index';

// ---------------------------------------------------------------------------
// An independent exact rational: [num, den], den > 0 (not reduced).
// ---------------------------------------------------------------------------
type Q = readonly [bigint, bigint];
const q = (n: bigint | number, d: bigint | number = 1n): Q => [BigInt(n), BigInt(d)];
const mul = (...xs: Q[]): Q => xs.reduce<Q>((a, b) => [a[0] * b[0], a[1] * b[1]], [1n, 1n]);
const div = (a: Q, b: Q): Q => [a[0] * b[1], a[1] * b[0]];
const pow = (a: Q, n: number): Q => [a[0] ** BigInt(n), a[1] ** BigInt(n)];

/** `num / den` (both > 0) rounded to the nearest double, ties to even, by integer arithmetic in base 2. */
function binaryRound(num: bigint, den: bigint): number {
  let shift = 0;
  const scaled = (k: number): bigint =>
    (num << BigInt(Math.max(k, 0))) / (den << BigInt(Math.max(-k, 0)));
  while (scaled(shift) < 2n ** 52n) shift++;
  while (scaled(shift) >= 2n ** 53n) shift--;
  const n = num << BigInt(Math.max(shift, 0));
  const d = den << BigInt(Math.max(-shift, 0));
  let m = n / d;
  const twice = 2n * (n % d);
  if (twice > d || (twice === d && m % 2n === 1n)) m += 1n;
  return Number(m) * 2 ** -shift;
}

/** π to 70 places (a different digit count from the engine's, on purpose). */
const PI: Q = [
  31415926535897932384626433832795028841971693993751058209749445923078164n,
  10n ** 70n,
];

/** A definition: the rational part and the power of π. */
type Def = readonly [Q, number];
const r = (x: Q): Def => [x, 0];
const expected = ([x, k]: Def): number => {
  const v = k === 0 ? x : k > 0 ? mul(x, pow(PI, k)) : div(x, pow(PI, -k));
  return binaryRound(v[0], v[1]);
};

// Defining values.
const inch = q(254, 10000); // 1959 agreement
const foot = mul(q(12), inch);
const yard = mul(q(3), foot);
const mile = mul(q(5280), foot);
const pound = q(45359237, 10n ** 8n); // 1959 agreement
const gn = q(980665, 100000); // 3rd CGPM 1901
const lbf = mul(pound, gn);
const usGallon = mul(q(231), pow(inch, 3));
const flOz = div(usGallon, q(128));
const julianYear = q(36525 * 864); // 365.25 d
const c = q(299792458);
const au = q(149597870700n); // IAU 2012 B2
const atm = q(101325);
const calIT = q(41868, 10000);

const DEFINITIONS: Record<string, Def> = {
  meter: r(q(1)),
  m: r(q(1)),
  inch: r(inch),
  in: r(inch),
  foot: r(foot),
  ft: r(foot),
  yard: r(yard),
  yd: r(yard),
  mile: r(mile),
  mi: r(mile),
  link: r(mul(q(66, 100), foot)),
  li: r(mul(q(66, 100), foot)),
  rod: r(mul(q(33, 2), foot)),
  rd: r(mul(q(33, 2), foot)),
  chain: r(mul(q(66), foot)),
  ch: r(mul(q(66), foot)),
  angstrom: r(q(1, 10n ** 10n)),
  astronomicalUnit: r(au),
  lightyear: r(mul(c, julianYear)),
  ly: r(mul(c, julianYear)),
  parsec: [mul(q(648000), au), -1],
  pc: [mul(q(648000), au), -1], // IAU 2015 B2
  nauticalMile: r(q(1852)),
  fathom: r(mul(q(6), foot)),
  furlong: r(mul(q(660), foot)),
  point: r(div(inch, q(72))),
  pica: r(div(inch, q(6))),
  mil: r(div(inch, q(1000))),
  m2: r(q(1)),
  sqin: r(pow(inch, 2)),
  sqft: r(pow(foot, 2)),
  sqyd: r(pow(yard, 2)),
  sqmi: r(pow(mile, 2)),
  sqrd: r(pow(mul(q(33, 2), foot), 2)),
  sqch: r(pow(mul(q(66), foot), 2)),
  sqmil: r(pow(div(inch, q(1000)), 2)),
  acre: r(mul(q(43560), pow(foot, 2))),
  hectare: r(q(10000)),
  m3: r(q(1)),
  L: r(q(1, 1000)),
  l: r(q(1, 1000)),
  litre: r(q(1, 1000)),
  cuin: r(pow(inch, 3)),
  cuft: r(pow(foot, 3)),
  cuyd: r(pow(yard, 3)),
  teaspoon: r(q(5, 10n ** 6n)),
  tablespoon: r(q(15, 10n ** 6n)), // metric spoons (convention)
  drop: r(q(5, 10n ** 8n)),
  gtt: r(q(5, 10n ** 8n)), // 0.05 mL (convention)
  minim: r(div(flOz, q(480))),
  fluiddram: r(div(flOz, q(8))),
  fluidounce: r(flOz),
  gill: r(mul(q(4), flOz)),
  cc: r(q(1, 10n ** 6n)),
  cup: r(mul(q(8), flOz)),
  pint: r(mul(q(16), flOz)),
  quart: r(mul(q(32), flOz)),
  gallon: r(usGallon),
  beerbarrel: r(mul(q(31), usGallon)),
  oilbarrel: r(mul(q(42), usGallon)),
  hogshead: r(mul(q(63), usGallon)),
  g: r(q(1, 1000)),
  gram: r(q(1, 1000)),
  ton: r(mul(q(2000), pound)),
  t: r(q(1000)),
  tonne: r(q(1000)),
  grain: r(div(pound, q(7000))),
  gr: r(div(pound, q(7000))),
  dram: r(div(pound, q(256))),
  dr: r(div(pound, q(256))),
  ounce: r(div(pound, q(16))),
  oz: r(div(pound, q(16))),
  poundmass: r(pound),
  lbm: r(pound),
  hundredweight: r(mul(q(100), pound)),
  cwt: r(mul(q(100), pound)),
  stick: r(q(115, 1000)), // butter stick as mathjs states it (convention)
  stone: r(mul(q(14), pound)),
  s: r(q(1)),
  second: r(q(1)),
  sec: r(q(1)),
  min: r(q(60)),
  minute: r(q(60)),
  h: r(q(3600)),
  hour: r(q(3600)),
  day: r(q(86400)),
  week: r(q(604800)),
  month: r(div(julianYear, q(12))),
  year: r(julianYear),
  decade: r(mul(q(10), julianYear)),
  century: r(mul(q(100), julianYear)),
  millennium: r(mul(q(1000), julianYear)),
  hertz: r(q(1)),
  Hz: r(q(1)),
  rad: r(q(1)),
  radian: r(q(1)),
  deg: [q(1, 180), 1],
  degree: [q(1, 180), 1],
  grad: [q(1, 200), 1],
  gradian: [q(1, 200), 1],
  cycle: [q(2), 1],
  arcsec: [q(1, 648000), 1],
  arcmin: [q(1, 10800), 1],
  A: r(q(1)),
  ampere: r(q(1)),
  K: r(q(1)),
  kelvin: r(q(1)),
  degC: r(q(1)),
  celsius: r(q(1)),
  degF: r(q(5, 9)),
  fahrenheit: r(q(5, 9)),
  degR: r(q(5, 9)),
  rankine: r(q(5, 9)),
  mol: r(q(1)),
  mole: r(q(1)),
  cd: r(q(1)),
  candela: r(q(1)),
  sr: r(q(1)),
  steradian: r(q(1)),
  N: r(q(1)),
  newton: r(q(1)),
  dyn: r(q(1, 100000)),
  dyne: r(q(1, 100000)),
  lbf: r(lbf),
  poundforce: r(lbf),
  kip: r(mul(q(1000), lbf)),
  kilogramforce: r(gn),
  J: r(q(1)),
  joule: r(q(1)),
  erg: r(q(1, 10n ** 7n)),
  Wh: r(q(3600)),
  cal: r(q(4184, 1000)),
  calorie: r(q(4184, 1000)), // thermochemical (NIST SP 811)
  BTU: r(div(mul(calIT, pound, q(1000)), q(18, 10))), // International Table BTU
  eV: r(q(1602176634n, 10n ** 28n)),
  electronvolt: r(q(1602176634n, 10n ** 28n)),
  W: r(q(1)),
  watt: r(q(1)),
  hp: r(mul(q(550), foot, lbf)),
  VA: r(q(1)),
  Pa: r(q(1)),
  psi: r(div(lbf, pow(inch, 2))),
  atm: r(atm),
  bar: r(q(100000)),
  torr: r(div(atm, q(760))),
  mmHg: r(q(133322387415n, 10n ** 9n)), // conventional, NIST SP 811
  mmH2O: r(gn),
  cmH2O: r(mul(q(10), gn)),
  coulomb: r(q(1)),
  C: r(q(1)),
  farad: r(q(1)),
  F: r(q(1)),
  volt: r(q(1)),
  V: r(q(1)),
  ohm: r(q(1)),
  henry: r(q(1)),
  H: r(q(1)),
  siemens: r(q(1)),
  S: r(q(1)),
  weber: r(q(1)),
  Wb: r(q(1)),
  tesla: r(q(1)),
  T: r(q(1)),
  b: r(q(1)),
  bits: r(q(1)),
  B: r(q(8)),
  bytes: r(q(8)), // bit: its own BIT dimension
};
/** Rows whose value is not a real scale. */
const IMAGINARY = new Set(['VAR']);

const UNITS = (Unit as unknown as { UNITS: Record<string, { value: unknown; offset: number }> })
  .UNITS;
const builtIn = [...Object.keys(UNIT_ROWS), ...Object.keys(UNIT_ROW_ALIASES)];
const canonical = (name: string): string =>
  Object.prototype.hasOwnProperty.call(UNIT_ROWS, name) ? name : UNIT_ROW_ALIASES[name]!;

describe('every built-in unit equals its exact definition, rounded once', () => {
  it('the definition list covers every built-in name, and names nothing else', () => {
    const missing = builtIn.filter(
      (n) => !IMAGINARY.has(canonical(n)) && DEFINITIONS[canonical(n)] === undefined
    );
    expect(missing).toEqual([]);
    const extra = Object.keys(DEFINITIONS).filter((n) => !Object.hasOwn(UNIT_ROWS, n));
    expect(extra).toEqual([]);
  });

  it.each(builtIn.filter((n) => !IMAGINARY.has(canonical(n))))('%s', (name) => {
    const want = expected(DEFINITIONS[canonical(name)]!);
    expect(UNITS[name]!.value).toBe(want);
    expect(exactScaleToNumber(unitRowExactScale(name)!)).toBe(want);
  });

  it('the values the table used to round or misstate', () => {
    const si = (u: string): number => new Unit(1, u).toNumeric(siOf(u)) as number;
    const siOf = (u: string): string =>
      ({
        torr: 'Pa',
        mmHg: 'Pa',
        psi: 'Pa',
        hp: 'W',
        kip: 'N',
        pc: 'm',
        parsec: 'm',
        pica: 'm',
        rd: 'm',
        sqrd: 'm^2',
        sqch: 'm^2',
        acre: 'm^2',
      })[u]!;
    expect(si('torr')).toBe(133.32236842105263);
    expect(si('mmHg')).toBe(133.322387415);
    expect(si('psi')).toBe(6894.757293168362);
    expect(si('hp')).toBe(745.6998715822702);
    expect(si('kip')).toBe(4448.2216152605);
    expect(si('pc')).toBe(3.085677581491367e16);
    expect(si('parsec')).toBe(3.085677581491367e16);
    expect(si('pica')).toBe(0.004233333333333334);
    expect(si('rd')).toBe(5.0292);
    expect(si('sqrd')).toBe(25.29285264);
    expect(si('sqch')).toBe(404.68564224);
    expect(si('acre')).toBe(4046.8564224);
  });

  it('torr and mmHg are distinct units (1/760 atm vs the conventional 13.5951 g/cm^3 column)', () => {
    expect(UNITS.torr!.value).not.toBe(UNITS.mmHg!.value);
    expect(unitRowExactScale('torr')).toEqual(ratioExactScale(101325, 760));
    expect(unitRowExactScale('mmHg')).toEqual(decimalExactScale('133.322387415'));
    expect(new Unit(760, 'torr').toNumeric('atm')).toBe(1);
    expect(new Unit(760, 'mmHg').toNumeric('atm')).not.toBe(1);
  });

  it('the calorie is the thermochemical one, and BTU the International Table one', () => {
    expect(new Unit(1, 'kcal').toNumeric('J')).toBe(4184);
    expect(new Unit(1, 'BTU').toNumeric('J')).toBe(1055.05585262);
  });

  it('affine offsets are exact and stated in the unit’s own degrees', () => {
    expect(UNITS.degC!.offset).toBe(273.15);
    expect(UNITS.degF!.offset).toBe(459.67);
    expect(UNITS.degR!.offset).toBe(0);
  });

  it('VAR is the one row with an imaginary value', () => {
    expect([...IMAGINARY].every((n) => UNIT_ROWS[n]?.imaginary === true)).toBe(true);
    expect(Object.keys(UNIT_ROWS).filter((n) => UNIT_ROWS[n]!.imaginary)).toEqual([...IMAGINARY]);
  });

  it('the flat registry (ALL_UNITS) reads the same rows', () => {
    for (const [name, def] of Object.entries(ALL_UNITS)) {
      if (name === 'kg') continue; // the base unit; the table's mass row is g
      const tableName = ({ ha: 'hectare', Ω: 'ohm' } as Record<string, string>)[name] ?? name;
      expect(def.multiplier).toBe(expected(DEFINITIONS[canonical(tableName)]!));
    }
    expect(ALL_UNITS.degF!.offset).toBe(binaryRound(45967n * 5n, 100n * 9n)); // 459.67 × 5/9 K
  });
});

describe('the exact-scale engine', () => {
  it('reads decimals digit for digit and numbers by their shortest decimal', () => {
    expect(decimalExactScale('0.0254')).toEqual({ num: 127n, den: 5000n, pi: 0 });
    expect(exactScaleOf(0.1)).toEqual({ num: 1n, den: 10n, pi: 0 });
    expect(binaryExactScale(0.1)).toEqual({ num: 3602879701896397n, den: 2n ** 55n, pi: 0 });
    expect(binaryExactScale(-2.5)).toEqual({ num: -5n, den: 2n, pi: 0 });
    expect(binaryExactScale(5e-324)).toEqual({ num: 1n, den: 2n ** 1074n, pi: 0 });
  });

  it('rounds a rational once, agreeing with base-2 integer rounding', () => {
    const dens = [3n, 7n, 760n, 2n ** 89n - 1n, 3n ** 70n, 10n ** 60n + 7n];
    let seed = 12345n;
    const next = (): bigint =>
      (seed = (seed * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n);
    for (const den of dens) {
      for (let i = 0; i < 30; i++) {
        const num = ((next() * next()) % (den * 1000n)) + 1n;
        expect(exactScaleToNumber(ratioExactScale(num, den))).toBe(binaryRound(num, den));
      }
    }
  });

  it('rounds an exact tie half to even', () => {
    const even = 2n ** 52n + 2n;
    const odd = 2n ** 52n + 3n;
    expect(exactScaleToNumber(ratioExactScale(2n * even + 1n, 2n ** 54n))).toBe(
      Number(even) / 2 ** 53
    );
    expect(exactScaleToNumber(ratioExactScale(2n * odd + 1n, 2n ** 54n))).toBe(
      Number(odd + 1n) / 2 ** 53
    );
  });

  it('reads a scale expression with one solidus: a/b*c is a/(b·c)', () => {
    expect(readScaleExpression('6/2*3')).toEqual(ratioExactScale(1));
    expect(readScaleExpression('pi/180')).toEqual({ num: 1n, den: 180n, pi: 1 });
    expect(readScaleExpression('2^-3')).toEqual(ratioExactScale(1, 8));
    expect(() => readScaleExpression('furlong')).toThrow(/not a known scale/);
  });
});

describe('conversions multiply exact scales and round once', () => {
  it.each([
    [1, 'g/cm^3', 'kg/m^3', 1000],
    [72, 'mN/m', 'N/m', 0.072],
    [1, 'ug', 'kg', 1e-9],
    [3, 'mm^2', 'm^2', 3e-6],
    [250, 'mL', 'm^3', 0.00025],
    [1, 'kcal', 'J', 4184],
    [1, 'mile/hour', 'm/s', 0.44704],
    [32, 'degF', 'K', 273.15],
    [25, 'degC', 'K', 298.15],
    [212, 'degF', 'degC', 100],
    [0, 'degC', 'degF', 32],
    [-40, 'degF', 'degC', -40],
    [491.67, 'degR', 'degF', 32],
    [300, 'K', 'degC', 26.85],
  ])('%s %s is %s %s', (value, from, to, want) => {
    expect(new Unit(value, from).to(to).toNumeric()).toBe(want);
  });

  it('Unit.exactScale gives a compound unit its exact scale', () => {
    expect(Unit.exactScale('g/cm^3')).toEqual(ratioExactScale(1000));
    // 0.45359237 kg × 9.80665 m/s² / (0.0254 m)²
    expect(Unit.exactScale('psi')).toEqual(
      ratioExactScale(45359237n * 980665n * 10n ** 8n, 254n ** 2n * 10n ** 13n)
    );
    expect(Unit.exactScale('kdeg')).toEqual({ num: 50n, den: 9n, pi: 1 });
    expect(Unit.exactScale('VAR')).toBeNull();
  });

  it('a Fraction value converts exactly; a BigNumber value at its precision', () => {
    const f = new Unit(new Fraction(1n) as never, 'torr').toSI().value as unknown as Fraction;
    expect([f.numerator, f.denominator]).toEqual([20265n, 152n]);
    const b = new Unit(BigNumber.fromNumber(1) as never, 'psi').toSI().value as unknown as {
      toString(): string;
    };
    expect(b.toString().startsWith('6894.757293168361336722')).toBe(true);
  });
});
