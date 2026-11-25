/**
 * #737: the instance type has no index signature; compat members keep their own types and the
 * rest of the functions namespace is typed from the functions package. `tsc -p tsconfig.test.json`
 * (the typecheck script) enforces this file.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { UnitInstance } from '@danielsimonjr/mathts-core';
import { create, all, sqrt, unit, unitDependencies, type MathInstance } from '../src/index.js';

describe('MathInstance type (#737)', () => {
  it('add(1, 2) is a number', () => {
    const math = create(all);
    const n: number = math.add(1, 2);
    expect(n).toBe(3);
  });

  it('infers scalar units through named, instance, and selected calls', () => {
    const math = create(all);
    const selected = create({ unitDependencies });
    const distance: UnitInstance = sqrt(unit('9 cm^2'));
    const converted: UnitInstance = math.unit(3, unit('cm'));
    const selectedUnit: UnitInstance = selected.unit('3 cm');
    expect(distance.formatUnits()).toBe('cm');
    expect(converted.equals(distance)).toBe(true);
    expect(selectedUnit.equals(distance)).toBe(true);
  });

  it('has no string index signature', () => {
    expectTypeOf<string extends keyof MathInstance ? true : false>().toEqualTypeOf<false>();
  });

  it('keeps the explicit compat members', () => {
    expectTypeOf<MathInstance['config']>().toBeFunction();
    expectTypeOf<MathInstance['evaluate']>().toBeFunction();
  });

  it('types a functions-namespace member that compat does not override', () => {
    const math = create(all);
    expectTypeOf(math.det).toBeFunction();
  });
});
