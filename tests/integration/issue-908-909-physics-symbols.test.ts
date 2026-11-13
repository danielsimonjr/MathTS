import { describe, it, expect } from 'vitest';
import {
  evaluate,
  physicsScope,
  gravitationConstant,
  speedOfLight,
  reducedPlanckConstant,
} from '@danielsimonjr/mathts-functions';
import { Unit, isUnit, type UnitInstance } from '@danielsimonjr/mathts-units';

/**
 * Issues #908 and #909: `evaluate('G')`, `evaluate('c')` and `evaluate('hbar')` do not
 * return the physical constants.
 *
 * In the default scope a short symbol that names a unit reads as that unit: `G` is the
 * gauss, `hbar` is the hectobar (bar with the prefix `h`), `c` is the speed of light as a
 * unit (as in `GeV/c^2`). A physicist's constants need `{ physics: true }` or
 * `physicsScope()`. Binding the letters by default would change `5 G to T` and
 * `1 hbar to Pa`, which work today, so the default stays and the physics mode is the
 * documented way.
 */
function asUnit(value: unknown): UnitInstance {
  expect(isUnit(value)).toBe(true);
  return value as UnitInstance;
}

describe('#908 #909 the physics symbols G, c and hbar', () => {
  it('reads each short symbol as a unit in the default scope', () => {
    for (const [symbol, text] of [
      ['G', 'G'],
      ['c', 'c'],
      ['hbar', 'hbar'],
    ] as const) {
      const unit = asUnit(evaluate(symbol));
      expect(unit.value).toBeNull();
      expect(String(unit)).toBe(text);
    }
  });

  it('keeps the unit readings that the default scope gives', () => {
    expect(asUnit(evaluate('5 G to T')).toNumeric('T')).toBeCloseTo(5e-4, 15);
    expect(asUnit(evaluate('1 hbar to Pa')).toNumeric('Pa')).toBeCloseTo(1e7, 6);
    expect(asUnit(evaluate('2 c to m/s')).toNumeric('m/s')).toBe(2 * 299792458);
    expect(asUnit(evaluate('1 GeV/c^2 to kg')).toNumeric('kg')).toBeCloseTo(1.78266192e-27, 34);
  });

  it('binds the constants with { physics: true }', () => {
    const g = asUnit(evaluate('G', undefined, { physics: true }));
    const c = asUnit(evaluate('c', undefined, { physics: true }));
    const hbar = asUnit(evaluate('hbar', undefined, { physics: true }));
    expect(g.value).toBe(gravitationConstant.value);
    expect(g.toSI().toString()).toBe(gravitationConstant.toSI().toString());
    expect(c.value).toBe(299792458);
    expect(c.value).toBe(speedOfLight.value);
    expect(hbar.value).toBe(reducedPlanckConstant.value);
    expect(hbar.dimensions).toEqual(reducedPlanckConstant.dimensions);
  });

  it('binds the same constants through physicsScope()', () => {
    const scope = physicsScope();
    expect(asUnit(evaluate('G', scope)).value).toBe(gravitationConstant.value);
    expect(asUnit(evaluate('c', scope)).value).toBe(speedOfLight.value);
    expect(asUnit(evaluate('hbar', scope)).value).toBe(reducedPlanckConstant.value);
  });

  it('uses the constants in a formula from the issue text', () => {
    const energy = asUnit(evaluate('hbar * omega', { omega: 2 }, { physics: true }));
    expect(energy.value).toBeCloseTo(2 * (reducedPlanckConstant.value as number), 45);
    expect(evaluate('2*pi*f', { f: 3 }, { physics: true })).toBeCloseTo(6 * Math.PI, 12);
    const restEnergy = asUnit(evaluate('m * c^2', { m: new Unit(1, 'kg') }, { physics: true }));
    expect(restEnergy.toNumeric('J')).toBe(299792458 ** 2);
  });

  it('keeps the long names in the default scope', () => {
    expect(asUnit(evaluate('gravitationConstant')).value).toBe(gravitationConstant.value);
    expect(asUnit(evaluate('speedOfLight')).value).toBe(299792458);
    expect(asUnit(evaluate('reducedPlanckConstant')).value).toBe(reducedPlanckConstant.value);
  });
});
