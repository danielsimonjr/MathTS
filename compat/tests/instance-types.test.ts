/**
 * #737: the instance type has no index signature; compat members keep their own types and the
 * rest of the functions namespace is typed from the functions package. `tsc -p tsconfig.test.json`
 * (the typecheck script) enforces this file.
 *
 * `expectTypeOf` is vitest-only and is not implemented by `bun test` (compat's runner).
 * Compile-time checks use typed assignments; runtime checks use `typeof`.
 */
import { describe, it, expect } from 'vitest';
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
    type HasStringIndex = string extends keyof MathInstance ? true : false;
    const noIndex: HasStringIndex = false;
    expect(noIndex).toBe(false);
  });

  it('keeps the explicit compat members', () => {
    const math = create(all);
    const config: MathInstance['config'] = math.config;
    const evaluate: MathInstance['evaluate'] = math.evaluate;
    expect(typeof config).toBe('function');
    expect(typeof evaluate).toBe('function');
  });

  it('types a functions-namespace member that compat does not override', () => {
    const math = create(all);
    const det: MathInstance['det'] = math.det;
    expect(typeof det).toBe('function');
  });
});
