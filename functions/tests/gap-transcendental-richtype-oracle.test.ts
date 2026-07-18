/**
 * Oracle parity guard for the rich-type (BigNumber / Complex) cases of the 12
 * transcendental scalars whose NAMES collide between `@danielsimonjr/mathts-core`
 * (scalar `number→number` primitive) and `functions/src/typed/{arithmetic,
 * trigonometry}.ts` (full typed dispatch). The collision is by name, not role —
 * the `number` case inlines `Math.*` as a V8 hot-path guard (kept local per
 * [[project-all-libraries-build-on-core]]), while the rich-type cases delegate to
 * the `Complex` / `BigNumber` class methods. This test PINS every rich-type case
 * against an implementation-independent oracle so the two layers can never
 * silently diverge, and it is the parity guard that justifies allow-listing the
 * name collisions in the dedup finder.
 *
 * Oracle: mpmath (70 dps) for high-precision real BigNumber; NumPy for complex.
 * Generated with tools in the session scratchpad; values are transcription-checked
 * against a probe of the live dispatchers.
 *
 * This audit found and fixed two real public-API bugs (both at root, in core):
 *   1. BigNumber.divide returned 0 / lost precision when the divisor coefficient
 *      had more digits than the scaled dividend — catastrophic for cbrt (e.g.
 *      cbrt(bignumber(2)) → ~4.6e-18) and ~11-digit precision loss for sqrt/asinh.
 *   2. Complex.acosh returned the wrong branch (negative real part) for Re(z) < 0;
 *      the principal value (C99 / NumPy) has Re ≥ 0.
 */
import { describe, it, expect } from 'vitest';
import { Complex, BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import { sinh, cosh, tanh, cbrt, log2, log10, sign } from '../src/typed/arithmetic.js';
import { asinh, acosh, atanh } from '../src/typed/trigonometry.js';

// -- oracle data (see header) -------------------------------------------------
const BN_ORACLE: Record<string, [number, string][]> = {
  sinh: [
    [0, '0.0'],
    [0.5, '0.5210953054937473616224256264114915591059289826114805279460935765'],
    [1, '1.175201193643801456882381850595600815155717981334095870229565413'],
    [-1, '-1.175201193643801456882381850595600815155717981334095870229565413'],
    [2, '3.626860407847018767668213982801261704886342012321135721309484475'],
    [-2, '-3.626860407847018767668213982801261704886342012321135721309484475'],
    [5, '74.20321057778875897700947199606456559961940900442581698066126979'],
    [0.1, '0.1001667500198440258237293835219050235149209168785588833683029862'],
  ],
  cosh: [
    [0, '1.0'],
    [0.5, '1.127625965206380785226225161402672012547847118098667483628985735'],
    [1, '1.543080634815243778477905620757061682601529112365863704737402215'],
    [-1, '1.543080634815243778477905620757061682601529112365863704737402215'],
    [2, '3.762195691083631459562213477773746108293973558230711602777643348'],
    [-2, '3.762195691083631459562213477773746108293973558230711602777643348'],
    [5, '74.20994852478784444410610804448771402386825858945317206609157532'],
    [0.1, '1.005004168055803598987978442968341644709626277858959835424560303'],
  ],
  tanh: [
    [0, '0.0'],
    [0.5, '0.4621171572600097585023184836436725487302892803301130385527318158'],
    [1, '0.7615941559557648881194582826047935904127685972579365515968105001'],
    [-1, '-0.7615941559557648881194582826047935904127685972579365515968105001'],
    [2, '0.9640275800758168839464137241009231502550299762409347760482632174'],
    [-2, '-0.9640275800758168839464137241009231502550299762409347760482632174'],
    [5, '0.9999092042625951312109904475344730210898126159905478627364288723'],
    [0.1, '0.09966799462495581711830508367835218353896209577673443693047643854'],
  ],
  asinh: [
    [0, '0.0'],
    [0.5, '0.4812118250596034474977589134243684231351843343856605196610181688'],
    [1, '0.8813735870195430252326093249797923090281603282616354107532956087'],
    [-1, '-0.8813735870195430252326093249797923090281603282616354107532956087'],
    [2, '1.443635475178810342493276740273105269405553003156981558983054507'],
    [-2, '-1.443635475178810342493276740273105269405553003156981558983054507'],
    [10, '2.998222950297969738846595537596453476607058054877303655734459263'],
  ],
  acosh: [
    [1, '0.0'],
    [1.5, '0.9624236501192068949955178268487368462703686687713210393220363377'],
    [2, '1.316957896924816708625046347307968444026981971467516479768472257'],
    [5, '2.292431669561177687800787311348015431621868240015710247605016445'],
    [10, '2.993222846126380897912667713774182913083660451180980642685145601'],
  ],
  atanh: [
    [0, '0.0'],
    [0.5, '0.5493061443340548456976226184612628523237452789113747258673471668'],
    [-0.5, '-0.5493061443340548456976226184612628523237452789113747258673471668'],
    [0.9, '1.472219489583220230004513715943926768618689630649564409268980118'],
    [-0.9, '-1.472219489583220230004513715943926768618689630649564409268980118'],
    [0.99, '2.646652412362246197705060645934268600945552640284736249453230494'],
  ],
  // cbrt(-8): real cube root −2 (mathjs convention for a real BigNumber), not the
  // principal complex root; the negative-input real branch is exercised here.
  cbrt: [
    [0, '0.0'],
    [1, '1.0'],
    [8, '2.0'],
    [27, '3.0'],
    [-8, '-2.0'],
    [2, '1.259921049894873164767210607278228350570251464701507980081975112'],
    [0.5, '0.7937005259840997373758528196361541301957466639499265049041428809'],
  ],
  log2: [
    [1, '0.0'],
    [2, '1.0'],
    [10, '3.321928094887362347870319429489390175864831393024580612054756396'],
    [100, '6.643856189774724695740638858978780351729662786049161224109512792'],
    [0.5, '-1.0'],
    [1000, '9.965784284662087043610958288468170527594494179073741836164269187'],
  ],
  log10: [
    [1, '0.0'],
    [2, '0.3010299956639811952137388947244930267681898814621085413104274611'],
    [10, '1.0'],
    [100, '2.0'],
    [0.5, '-0.3010299956639811952137388947244930267681898814621085413104274611'],
    [1000, '3.0'],
  ],
};

const CX_ORACLE: Record<string, [number, number, number, number][]> = {
  sinh: [
    [1, 1, 0.6349639147847361, 1.2984575814159773],
    [2, -3, -3.59056458998578, -0.5309210862485197],
    [-1, 0.5, -1.0313360742545512, 0.7397922644560138],
    [0.5, 0.5, 0.4573041531842493, 0.5406126857131534],
    [3, 4, -6.5481200409110025, -7.61923172032141],
    [-2, -2, 1.5093064853236158, -3.4209548611170133],
    [0, 1, 0.0, 0.8414709848078965],
    [1, 0, 1.1752011936438014, 0.0],
    [0.5, -1, 0.28154899513533443, -0.948864531437168],
    [-0.5, 2, 0.21685216292078974, 1.0253473885839877],
  ],
  cosh: [
    [1, 1, 0.8337300251311491, 0.9888977057628651],
    [2, -3, -3.7245455049153224, -0.5118225699873846],
    [-1, 0.5, 1.3541806567045842, -0.5634214652309818],
    [0.5, 0.5, 0.9895848833999199, 0.24982639750046154],
    [3, 4, -6.580663040551157, -7.581552742746545],
    [-2, -2, -1.5656258353157435, 3.297894836311237],
    [0, 1, 0.5403023058681398, 0.0],
    [1, 0, 1.5430806348152437, 0.0],
    [0.5, -1, 0.6092589091577942, -0.4384865798925953],
    [-0.5, 2, -0.4692579782290534, -0.473830620416407],
  ],
  tanh: [
    [1, 1, 1.0839233273386946, 0.27175258531951174],
    [2, -3, 0.9653858790221332, 0.009884375038322495],
    [-1, 0.5, -0.8429662048457832, 0.19557731006593398],
    [0.5, 0.5, 0.5640831412674985, 0.4038964553160257],
    [3, 4, 1.000709536067233, 0.004908258067496059],
    [-2, -2, -1.0238355945704727, 0.02839295286823229],
    [0, 1, 0.0, 1.5574077246549023],
    [1, 0, 0.7615941559557649, 0.0],
    [0.5, -1, 1.042830728344361, -0.806877412163085],
    [-0.5, 2, -1.3212865837711916, -0.8508781211449377],
  ],
  asinh: [
    [1, 1, 1.0612750619050357, 0.6662394324925152],
    [2, -3, 1.9686379257930964, -0.9646585044076028],
    [-1, 0.5, -0.9261330313501823, 0.34943906285721327],
    [0.5, 0.5, 0.5306375309525179, 0.45227844715119064],
    [3, 4, 2.2999140408792695, 0.9176168533514787],
    [-2, -2, -1.7343245214879666, -0.754249144698046],
    [0, 1, 0.0, 1.5707963267948966],
    [1, 0, 0.881373587019543, 0.0],
    [0.5, -1, 0.7328576759736453, -0.8959074812088902],
    [-0.5, 2, -1.3618009008578458, 1.2930420702371825],
  ],
  acosh: [
    [1, 1, 1.0612750619050357, 0.9045568943023814],
    [2, -3, 1.9833870299165355, -1.0001435424737972],
    [-1, 0.5, 0.7328576759736453, 2.466703808003787],
    [0.5, 0.5, 0.5306375309525179, 1.118517879643706],
    [3, 4, 2.305509031243477, 0.9368124611557199],
    [-2, -2, 1.7343245214879666, -2.3250454714929427],
    [0, 1, 0.881373587019543, 1.5707963267948966],
    [1, 0, 0.0, 0.0],
    [0.5, -1, 0.9261330313501823, -1.2213572639376833],
    [-0.5, 2, 1.4657153519472905, 1.7918149624177804],
  ],
  atanh: [
    [1, 1, 0.40235947810852507, 1.0172219678978514],
    [2, -3, 0.14694666622552977, -1.3389725222944935],
    [-1, 0.5, -0.708303336014054, 0.9078874949608804],
    [0.5, 0.5, 0.40235947810852507, 0.5535743588970452],
    [3, 4, 0.1175009073114339, 1.4099210495965755],
    [-2, -2, -0.2388778612568591, -1.311223269671635],
    [0, 1, 0.0, 0.7853981633974483],
    [0.5, -1, 0.2388778612568591, -0.847575660670829],
    [-0.5, 2, -0.09641562020299617, 1.1265564408348223],
  ],
  cbrt: [
    [1, 1, 1.0842150814913512, 0.2905145555072514],
    [2, -3, 1.4518566183526649, -0.49340353410400467],
    [-1, 0.5, 0.6511227389622266, 0.8082428619061661],
    [0.5, 0.5, 0.8605420804595791, 0.2305815555121424],
    [3, 4, 1.6289371459221758, 0.5201745023045458],
    [-2, -2, 1.0000000000000002, -1.0000000000000002],
    [0, 1, 0.8660254037844387, 0.49999999999999994],
    [1, 0, 1.0, 0.0],
    [0.5, -1, 0.968010263876075, -0.3743974813570645],
    [-0.5, 2, 1.0466245092929098, 0.7241429673663325],
  ],
  log2: [
    [1, 1, 0.5, 1.1330900354567983],
    [2, -3, 1.850219859070546, -1.417871630745722],
    [-1, 0.5, 0.16096404744368117, 3.8634580356017056],
    [0.5, 0.5, -0.4999999999999999, 1.1330900354567983],
    [3, 4, 2.321928094887362, 1.3378042124509761],
    [-2, -2, 1.5000000000000002, -3.399270106370395],
    [0, 1, 0.0, 2.2661800709135966],
    [1, 0, 0.0, 0.0],
    [0.5, -1, 0.16096404744368117, -1.5972779646881086],
    [-0.5, 2, 1.0437314206251695, 2.6196095733303317],
  ],
  log10: [
    [1, 1, 0.1505149978319906, 0.3410940884604603],
    [2, -3, 0.5569716761534184, -0.4268218908554666],
    [-1, 0.5, 0.04845500650402821, 1.1630167557051547],
    [0.5, 0.5, -0.15051499783199057, 0.3410940884604603],
    [3, 4, 0.6989700043360187, 0.4027191962733731],
    [-2, -2, 0.4515449934959718, -1.023282265381381],
    [0, 1, 0.0, 0.6821881769209206],
    [1, 0, 0.0, 0.0],
    [0.5, -1, 0.04845500650402821, -0.4808285787842341],
    [-0.5, 2, 0.31419446502515574, 0.7885810585009534],
  ],
};

// acosh on the real axis: principal branch must have Re ≥ 0 (regression guard for
// the Complex.acosh branch fix). NumPy reference values.
const CX_ACOSH_REAL: [number, number, number][] = [
  [-0.5, 0.0, 2.0943951023931957],
  [0.5, 0.0, 1.0471975511965979],
  [-3, 1.762747174039086, 3.141592653589793],
  [3, 1.762747174039086, 0.0],
  [-1, 0.0, 3.141592653589793],
  [1, 0.0, 0.0],
];

// full-precision functions (no transcendental-constant dependency in the path)
const BN_FULL_PREC = new Set(['sinh', 'cosh', 'tanh', 'cbrt']);
// ln-dependent functions: precision is bounded by core's ~50-digit LN2/LN10/PI
// constants, so pin to a looser (but still far-beyond-double) tolerance.
const BN_LN_PREC_TOL = 1e-40;
const BN_FULL_PREC_TOL = 1e-50;

const bnFns: Record<string, (a: BigNumber) => unknown> = {
  sinh,
  cosh,
  tanh,
  asinh,
  acosh,
  atanh,
  cbrt,
  log2,
  log10,
};
const cxFns: Record<string, (a: Complex) => Complex> = {
  sinh: (a) => sinh(a) as Complex,
  cosh: (a) => cosh(a) as Complex,
  tanh: (a) => tanh(a) as Complex,
  asinh: (a) => asinh(a) as Complex,
  acosh: (a) => acosh(a) as Complex,
  atanh: (a) => atanh(a) as Complex,
  cbrt: (a) => cbrt(a) as Complex,
  log2: (a) => log2(a) as Complex,
  log10: (a) => log10(a) as Complex,
};

/** Relative error of a BigNumber result vs a high-precision oracle string. */
function bnRelErr(actual: BigNumber, oracleStr: string): number {
  const oracle = BigNumber.parse(oracleStr);
  const err = actual.subtract(oracle).abs();
  if (oracle.isZero()) return err.valueOf();
  return err.divide(oracle.abs()).valueOf();
}

function expectComplexClose(actual: Complex, re: number, im: number, tol = 1e-12): void {
  expect(Math.abs(actual.re - re)).toBeLessThanOrEqual(tol + tol * Math.abs(re));
  expect(Math.abs(actual.im - im)).toBeLessThanOrEqual(tol + tol * Math.abs(im));
}

describe('transcendental rich-type cases — BigNumber oracle (mpmath)', () => {
  for (const name of Object.keys(bnFns)) {
    const tol = BN_FULL_PREC.has(name) ? BN_FULL_PREC_TOL : BN_LN_PREC_TOL;
    it(`${name}(BigNumber) matches mpmath to < ${tol}`, () => {
      for (const [x, oracle] of BN_ORACLE[name]) {
        const r = bnFns[name](BigNumber.fromNumber(x)) as BigNumber;
        expect(r).toBeInstanceOf(BigNumber);
        expect(bnRelErr(r, oracle)).toBeLessThan(tol);
      }
    });
  }

  it('asinh(BigNumber) is odd (negative arg = negation, no cancellation loss)', () => {
    for (const x of [0.5, 1, 2, 10, 100]) {
      const pos = asinh(BigNumber.fromNumber(x)) as BigNumber;
      const neg = asinh(BigNumber.fromNumber(-x)) as BigNumber;
      expect(neg.negate().subtract(pos).abs().divide(pos.abs()).valueOf()).toBeLessThan(1e-45);
    }
  });
});

describe('transcendental rich-type cases — Complex oracle (NumPy)', () => {
  for (const name of Object.keys(cxFns)) {
    it(`${name}(Complex) matches NumPy`, () => {
      for (const [re, im, ore, oim] of CX_ORACLE[name]) {
        expectComplexClose(cxFns[name](new Complex(re, im)), ore, oim);
      }
    });
  }

  it('acosh(Complex) principal branch has Re ≥ 0 (branch-cut regression)', () => {
    for (const [re, im] of CX_ORACLE.acosh) {
      const r = acosh(new Complex(re, im)) as Complex;
      // Re(acosh) is always ≥ 0 for the principal value.
      expect(r.re).toBeGreaterThanOrEqual(-1e-15);
    }
    for (const [x, ore, oim] of CX_ACOSH_REAL) {
      const r = acosh(new Complex(x, 0)) as Complex;
      expect(r.re).toBeGreaterThanOrEqual(-1e-15);
      expectComplexClose(r, ore, oim);
    }
  });
});

describe('sign — rich types and IEEE-754 edges', () => {
  it('number edges: sign(-0)=-0, sign(0)=0, sign(NaN)=NaN', () => {
    expect(Object.is(sign(-0), -0)).toBe(true);
    expect(Object.is(sign(0), 0)).toBe(true);
    expect(Number.isNaN(sign(NaN) as number)).toBe(true);
    expect(sign(5)).toBe(1);
    expect(sign(-5)).toBe(-1);
  });

  it('BigNumber: sign(±x)=±1, sign(0)=0', () => {
    expect((sign(BigNumber.fromNumber(5)) as BigNumber).valueOf()).toBe(1);
    expect((sign(BigNumber.fromNumber(-5)) as BigNumber).valueOf()).toBe(-1);
    expect((sign(BigNumber.fromNumber(0.001)) as BigNumber).valueOf()).toBe(1);
    expect((sign(BigNumber.fromNumber(-0.001)) as BigNumber).valueOf()).toBe(-1);
    expect((sign(BigNumber.fromNumber(0)) as BigNumber).valueOf()).toBe(0);
  });

  it('Fraction: sign(±p/q)=±1, sign(0)=0', () => {
    expect((sign(new Fraction(-3n, 4n)) as Fraction).valueOf()).toBe(-1);
    expect((sign(new Fraction(3n, 4n)) as Fraction).valueOf()).toBe(1);
    expect((sign(new Fraction(0n, 1n)) as Fraction).valueOf()).toBe(0);
  });

  it('Complex: sign(z)=z/|z|, sign(0)=0 (mathjs parity)', () => {
    const s = sign(new Complex(3, 4)) as Complex;
    expect(s.re).toBeCloseTo(0.6, 12);
    expect(s.im).toBeCloseTo(0.8, 12);
    const z0 = sign(new Complex(0, 0)) as Complex;
    expect(z0.re).toBe(0);
    expect(z0.im).toBe(0);
  });
});

describe('core numeric fixes surfaced by this audit (regression guards)', () => {
  it('BigNumber.divide handles a divisor with many more digits than the dividend', () => {
    // g*g is an un-rounded ~128-digit product; 2 / (g*g) previously collapsed to 0.
    const g = BigNumber.parse('1.259921049894873164767210607278229335829961333333333333333333333');
    const q = BigNumber.fromNumber(2).divide(g.multiply(g));
    // 2 / cbrt(2)^2 = cbrt(2) ≈ 1.2599210498948732
    expect(q.valueOf()).toBeCloseTo(1.2599210498948732, 12);
    expect(q.valueOf()).toBeGreaterThan(1.25);
  });

  it('BigNumber.sqrt / cbrt reach full precision (not ~11 digits)', () => {
    expect(
      bnRelErr(
        BigNumber.fromNumber(2).sqrt(),
        '1.414213562373095048801688724209698078569671875376948073176679738'
      )
    ).toBeLessThan(1e-50);
    expect(
      bnRelErr(
        cbrt(BigNumber.fromNumber(2)) as BigNumber,
        '1.259921049894873164767210607278228350570251464701507980081975112'
      )
    ).toBeLessThan(1e-50);
  });
});
