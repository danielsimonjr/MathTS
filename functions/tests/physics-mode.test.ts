import { describe, it, expect } from 'vitest';
import { isUnit, type UnitInstance } from '@danielsimonjr/mathts-core';
import { elementaryCharge } from '../src/factories/index.js';
import { compileExpr, evaluate, parser, physicsScope } from '../src/factories/evaluate.js';

/** CODATA / 2019 SI elementary charge, in coulombs. */
const ELEMENTARY_CHARGE_C = 1.602176634e-19;

function asUnit(value: unknown): UnitInstance {
  expect(isUnit(value)).toBe(true);
  return value as UnitInstance;
}

describe('physics mode for e', () => {
  it("keeps the default reading of e as Euler's number", () => {
    expect(evaluate('e')).toBeCloseTo(Math.E);
    expect(compileExpr('e').evaluate()).toBeCloseTo(Math.E);
    expect(parser().evaluate('e')).toBeCloseTo(Math.E);
  });

  it('reads bare e as the elementary charge 1.602176634e-19 C when physics is set', () => {
    const charge = asUnit(evaluate('e', undefined, { physics: true }));
    expect(charge.toNumber('C')).toBe(ELEMENTARY_CHARGE_C);
    expect(charge.dimensions).toEqual(elementaryCharge.dimensions);
    expect(charge.toSI().toString()).toBe(elementaryCharge.toSI().toString());
  });

  it("reaches Euler's number only through exp(x) in physics mode", () => {
    expect(evaluate('exp(1)', undefined, { physics: true })).toBeCloseTo(Math.E);
    expect(evaluate('exp(0)', undefined, { physics: true })).toBe(1);
    expect(compileExpr('exp(1)', { physics: true }).evaluate()).toBeCloseTo(Math.E);
    expect(parser({ physics: true }).evaluate('exp(1)')).toBeCloseTo(Math.E);
  });

  it('leaves E unbound so a caller can use it for energy', () => {
    expect(() => evaluate('E', undefined, { physics: true })).toThrow(/Undefined symbol "E"/);
    expect(evaluate('E', { E: 2.5 }, { physics: true })).toBe(2.5);
    const charge = asUnit(evaluate('e', { E: 2.5 }, { physics: true }));
    expect(charge.toNumber('C')).toBe(ELEMENTARY_CHARGE_C);
  });

  it('lets an explicit scope binding for e win over physics mode', () => {
    expect(evaluate('e', { e: 3 }, { physics: true })).toBe(3);
    expect(evaluate('e', physicsScope({ e: 4 }))).toBe(4);
  });

  it('accepts a physics scope in place of the option', () => {
    const charge = asUnit(evaluate('e', physicsScope()));
    expect(charge.toNumber('C')).toBe(ELEMENTARY_CHARGE_C);
    expect(evaluate('exp(1)', physicsScope())).toBeCloseTo(Math.E);
  });

  it('squares the charge with the existing power operator', () => {
    const squared = asUnit(evaluate('e^2', undefined, { physics: true }));
    const expected = elementaryCharge.pow(2) as UnitInstance;
    expect(squared.toNumber('C^2')).toBeCloseTo(expected.toNumber('C^2'));
    expect(squared.dimensions).toEqual(expected.dimensions);
  });

  it('refuses to add the charge to a dimensionless number', () => {
    expect(() => evaluate('1 + e', undefined, { physics: true })).toThrow();
  });

  it('applies physics mode to every expression in an array', () => {
    const [charge, euler] = evaluate(['e', 'exp(1)'], undefined, { physics: true });
    expect(asUnit(charge).toNumber('C')).toBe(ELEMENTARY_CHARGE_C);
    expect(euler).toBeCloseTo(Math.E);
  });

  it("keeps a Map scope's own e and still fills a missing e", () => {
    const withEnergy = new Map<string, unknown>([['E', 9]]);
    expect(evaluate('E', withEnergy, { physics: true })).toBe(9);
    expect(asUnit(evaluate('e', withEnergy, { physics: true })).toNumber('C')).toBe(
      ELEMENTARY_CHARGE_C
    );

    const withOwnE = new Map<string, unknown>([['e', 11]]);
    expect(evaluate('e', withOwnE, { physics: true })).toBe(11);
  });

  it('does not change pi, tau, or ordinary arithmetic', () => {
    expect(evaluate('pi', undefined, { physics: true })).toBeCloseTo(Math.PI);
    expect(evaluate('2 + 3', undefined, { physics: true })).toBe(5);
    expect(evaluate('sin(pi / 2)', undefined, { physics: true })).toBeCloseTo(1);
  });
});
