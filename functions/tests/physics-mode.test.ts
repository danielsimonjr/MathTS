import { describe, it, expect } from 'vitest';
import { isUnit, type UnitInstance } from '@danielsimonjr/mathts-core';
import {
  elementaryCharge,
  gravitationConstant,
  reducedPlanckConstant,
  speedOfLight,
} from '../src/factories/index.js';
import { compileExpr, evaluate, parser, physicsScope } from '../src/factories/evaluate.js';

/** CODATA / 2019 SI elementary charge, in coulombs. */
const ELEMENTARY_CHARGE_C = 1.602176634e-19;

function asUnit(value: unknown): UnitInstance {
  expect(isUnit(value)).toBe(true);
  return value as UnitInstance;
}

describe('physics mode for e0 (elementary charge)', () => {
  it("keeps the default reading of e as Euler's number", () => {
    expect(evaluate('e')).toBeCloseTo(Math.E);
    expect(compileExpr('e').evaluate()).toBeCloseTo(Math.E);
    expect(parser().evaluate('e')).toBeCloseTo(Math.E);
    expect(evaluate('e', physicsScope())).toBeCloseTo(Math.E);
  });

  it('reads e0 as the elementary charge when physics is set', () => {
    const charge = asUnit(evaluate('e0', undefined, { physics: true }));
    expect(charge.toNumber('C')).toBe(ELEMENTARY_CHARGE_C);
    expect(charge.dimensions).toEqual(elementaryCharge.dimensions);
    expect(charge.toSI().toString()).toBe(elementaryCharge.toSI().toString());
  });

  it("reaches Euler's number through exp(x) in physics mode", () => {
    expect(evaluate('exp(1)', undefined, { physics: true })).toBeCloseTo(Math.E);
    expect(evaluate('exp(0)', undefined, { physics: true })).toBe(1);
    expect(compileExpr('exp(1)', { physics: true }).evaluate()).toBeCloseTo(Math.E);
    expect(parser({ physics: true }).evaluate('exp(1)')).toBeCloseTo(Math.E);
  });

  it('leaves E unbound so a caller can use it for energy', () => {
    expect(() => evaluate('E', undefined, { physics: true })).toThrow(/Undefined symbol "E"/);
    expect(evaluate('E', { E: 2.5 }, { physics: true })).toBe(2.5);
    const charge = asUnit(evaluate('e0', { E: 2.5 }, { physics: true }));
    expect(charge.toNumber('C')).toBe(ELEMENTARY_CHARGE_C);
  });

  it('lets an explicit scope binding for e0 win over physics mode', () => {
    expect(evaluate('e0', { e0: 3 }, { physics: true })).toBe(3);
    expect(evaluate('e0', physicsScope({ e0: 4 }))).toBe(4);
  });

  it('exposes CODATA constants on physicsScope without rebinding e', () => {
    const scope = physicsScope() as Record<string, unknown>;
    expect(Object.keys(scope).sort()).toEqual(['G', 'c', 'e0', 'elementaryCharge', 'hbar'].sort());
    const charge = asUnit(evaluate('e0', scope));
    expect(charge.toNumber('C')).toBe(ELEMENTARY_CHARGE_C);
    expect(asUnit(evaluate('G', scope)).toNumber()).toBeCloseTo(gravitationConstant.toNumber(), 12);
    expect(asUnit(evaluate('c', scope)).toNumber()).toBe(speedOfLight.toNumber());
    expect(asUnit(evaluate('hbar', scope)).toNumber()).toBeCloseTo(
      reducedPlanckConstant.toNumber(),
      12
    );
    expect(evaluate('e', scope)).toBeCloseTo(Math.E);
    expect(evaluate('exp(1)', scope)).toBeCloseTo(Math.E);
  });

  it('squares the charge with the existing power operator', () => {
    const squared = asUnit(evaluate('e0^2', undefined, { physics: true }));
    const expected = elementaryCharge.pow(2) as UnitInstance;
    expect(squared.toNumber('C^2')).toBeCloseTo(expected.toNumber('C^2'));
    expect(squared.dimensions).toEqual(expected.dimensions);
  });

  it('refuses to add the charge to a dimensionless number', () => {
    expect(() => evaluate('1 + e0', undefined, { physics: true })).toThrow();
  });

  it('applies physics mode to every expression in an array', () => {
    const [charge, euler] = evaluate(['e0', 'exp(1)'], undefined, { physics: true });
    expect(asUnit(charge).toNumber('C')).toBe(ELEMENTARY_CHARGE_C);
    expect(euler).toBeCloseTo(Math.E);
  });

  it("keeps a Map scope's own e0 and still fills a missing e0", () => {
    const withEnergy = new Map<string, unknown>([['E', 9]]);
    expect(evaluate('E', withEnergy, { physics: true })).toBe(9);
    expect(asUnit(evaluate('e0', withEnergy, { physics: true })).toNumber('C')).toBe(
      ELEMENTARY_CHARGE_C
    );

    const withOwnE0 = new Map<string, unknown>([['e0', 11]]);
    expect(evaluate('e0', withOwnE0, { physics: true })).toBe(11);
  });

  it('does not change pi, tau, or ordinary arithmetic', () => {
    expect(evaluate('pi', undefined, { physics: true })).toBeCloseTo(Math.PI);
    expect(evaluate('2 + 3', undefined, { physics: true })).toBe(5);
    expect(evaluate('sin(pi / 2)', undefined, { physics: true })).toBeCloseTo(1);
  });

  it('binds e0 as the SI magnitude when charge is scalar', () => {
    const options = { physics: true, charge: 'scalar' as const };
    expect(evaluate('e0', undefined, options)).toBe(ELEMENTARY_CHARGE_C);
    expect(evaluate('1 - e0^2', undefined, options)).toBeCloseTo(1 - ELEMENTARY_CHARGE_C ** 2);
    expect(evaluate('e0^2', undefined, options)).toBeCloseTo(ELEMENTARY_CHARGE_C ** 2);
    expect(evaluate('exp(1)', undefined, options)).toBeCloseTo(Math.E);
    expect(() => evaluate('E', undefined, options)).toThrow(/Undefined symbol "E"/);
    expect(evaluate('e0', { e0: 3 }, options)).toBe(3);
    expect(compileExpr('1 - e0^2', options).evaluate()).toBeCloseTo(1 - ELEMENTARY_CHARGE_C ** 2);
    expect(parser(options).evaluate('e0')).toBe(ELEMENTARY_CHARGE_C);
    expect(evaluate('e0', physicsScope(undefined, { charge: 'scalar' }))).toBe(ELEMENTARY_CHARGE_C);
  });

  it('still returns a Unit from physics mode when charge is omitted', () => {
    expect(() => evaluate('1 - e0^2', undefined, { physics: true })).toThrow();
    expect(asUnit(evaluate('e0', undefined, { physics: true, charge: 'unit' })).toNumber('C')).toBe(
      ELEMENTARY_CHARGE_C
    );
  });

  it('rejects charge without physics mode', () => {
    expect(() => evaluate('e0', undefined, { charge: 'scalar' })).toThrow(/physics: true/);
    expect(() => compileExpr('e0', { charge: 'scalar' })).toThrow(/physics: true/);
  });
});
