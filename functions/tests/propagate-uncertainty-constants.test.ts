/**
 * #910: `propagateUncertainty` could not take a CODATA constant.
 *
 * #827 gave each constant an absolute `.uncertainty`, but the function read each
 * input as a bare number, so a `Unit` constant failed with
 * `values.fixPrefix is not a finite number`. A value may now be a constant: the
 * callback and the expression read its SI magnitude, and its `.uncertainty` (converted
 * to the same SI scale) is the input sigma unless `sigmas` names the input.
 *
 * Oracle for E = m c^2: dE/dm = c^2 and dE/dc = 2 m c, so with an exact c
 * sigma(E) = c^2 sigma(m).
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Unit } from '@danielsimonjr/mathts-core';
import {
  electronMass,
  speedOfLight,
  fermiCoupling,
  fineStructure,
  planckTime,
  gravitationConstant,
  propagateUncertainty,
} from '../src/index.js';

const C = 299792458;
const ME = 9.1093837139e-31;
const ME_SIGMA = 2.8e-40;

type Values = Record<string, number>;

describe('propagateUncertainty accepts CODATA constants (#910)', () => {
  it('propagates the uncertainty of the electron mass through E = m c^2', () => {
    const result = propagateUncertainty((v: Values) => v.m * v.c * v.c, {
      m: electronMass,
      c: speedOfLight,
    });
    expect(result.value / (ME * C * C)).toBeCloseTo(1, 12);
    expect(result.partials.m / (C * C)).toBeCloseTo(1, 8);
    expect(result.partials.c / (2 * ME * C)).toBeCloseTo(1, 8);
    expect(result.sigma).toBeGreaterThan(0);
    expect(result.sigma / (C * C * ME_SIGMA)).toBeCloseTo(1, 8);
  });

  it('gives the same answer for a string expression', () => {
    const result = propagateUncertainty('m * c^2', { m: electronMass, c: speedOfLight });
    expect(result.value / (ME * C * C)).toBeCloseTo(1, 12);
    expect(result.sigma / (C * C * ME_SIGMA)).toBeCloseTo(1, 12);
  });

  it('lets an explicit sigma win over the constant uncertainty', () => {
    const result = propagateUncertainty(
      'm * c^2',
      { m: electronMass, c: speedOfLight },
      { m: 1e-39 }
    );
    expect(result.sigma / (C * C * 1e-39)).toBeCloseTo(1, 12);
  });

  it('lets a covariance replace the constant uncertainties', () => {
    const result = propagateUncertainty(
      'm * c^2',
      { m: electronMass, c: speedOfLight },
      undefined,
      {
        covariance: [
          [1e-80, 0],
          [0, 0],
        ],
      }
    );
    expect(result.sigma / (C * C * 1e-40)).toBeCloseTo(1, 12);
  });

  it('adds no variance for a Unit that carries no uncertainty', () => {
    const result = propagateUncertainty('x * 2', { x: new Unit(3, 'm') });
    expect(result.value).toBe(6);
    expect(result.sigma).toBe(0);
  });

  it('mixes constants with plain numbers and their sigmas', () => {
    const result = propagateUncertainty(
      'G * m / r^2',
      { G: gravitationConstant, m: 5.972e24, r: 6.371e6 },
      { m: 6e20, r: 1e3 }
    );
    const g = gravitationConstant.toNumeric() as number;
    const dG = 1.5e-15;
    const dm = 6e20;
    const dr = 1e3;
    const m = 5.972e24;
    const r = 6.371e6;
    const expected = Math.hypot((m / r ** 2) * dG, (g / r ** 2) * dm, ((2 * g * m) / r ** 3) * dr);
    expect(result.sigma / expected).toBeCloseTo(1, 6);
  });

  it('converts the uncertainty to the SI scale of a constant written in another unit', () => {
    // fermiCoupling is written in GeV^-2; its SI value is in J^-2.
    const si = (fermiCoupling as unknown as { value: number }).value;
    const shown = fermiCoupling.toNumeric() as number;
    const unc = (fermiCoupling as unknown as { uncertainty: number }).uncertainty;
    const result = propagateUncertainty('g * 3', { g: fermiCoupling });
    expect(result.value / (3 * si)).toBeCloseTo(1, 12);
    expect(result.sigma / (3 * unc * (si / shown))).toBeCloseTo(1, 12);
  });

  it('reads a dimensionless CODATA scalar', () => {
    const result = propagateUncertainty('2 * a', { a: fineStructure });
    expect(result.value / (2 * Number(fineStructure))).toBeCloseTo(1, 12);
    expect(result.sigma / (2 * 1.1e-12)).toBeCloseTo(1, 12);
  });

  it('reads a BigNumber constant (the BigNumber configuration) with its uncertainty', () => {
    const alpha = new BigNumber('0.0072973525643');
    Object.defineProperty(alpha, 'uncertainty', { value: 1.1e-12 });
    const result = propagateUncertainty('2 * a', { a: alpha });
    expect(result.value / (2 * 0.0072973525643)).toBeCloseTo(1, 12);
    expect(result.sigma / (2 * 1.1e-12)).toBeCloseTo(1, 12);
    // A BigNumber with no uncertainty is a plain number: it adds no variance.
    expect(propagateUncertainty('2 * a', { a: new BigNumber('3') }).sigma).toBe(0);
  });

  it('keeps the finite-difference step relative for a tiny constant', () => {
    // planckTime is about 5.4e-44 s. The partial of 1/t is -1/t^2.
    const t = Number(planckTime.toNumeric());
    const result = propagateUncertainty((v: Values) => 1 / v.t, { t: planckTime });
    expect(result.partials.t / (-1 / (t * t))).toBeCloseTo(1, 6);
  });

  it('differentiates a function at zero', () => {
    const result = propagateUncertainty((v: Values) => Math.exp(v.x), { x: 0 }, { x: 1 });
    expect(result.partials.x).toBeCloseTo(1, 6);
  });

  it('says what a Unit passed as the values record means', () => {
    expect(() => propagateUncertainty((v: Values) => v.m, electronMass as never)).toThrow(
      /values must be an object/
    );
    expect(() => propagateUncertainty('x', [1] as never)).toThrow(/values must be an object/);
  });

  it('still rejects a value that is not a number or a constant', () => {
    expect(() => propagateUncertainty('x', { x: 'a' as never })).toThrow(
      /values\.x is not a finite number/
    );
    expect(() => propagateUncertainty('x', { x: new Unit(null, 'm') })).toThrow(/values\.x/);
  });
});
