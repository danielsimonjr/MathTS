/**
 * #737: the instance type has no index signature; compat members keep their own types and the
 * rest of the functions namespace is typed from the functions package. `tsc -p tsconfig.test.json`
 * (the typecheck script) enforces this file.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { create, all, type MathInstance } from '../src/index.js';

describe('MathInstance type (#737)', () => {
  it('add(1, 2) is a number', () => {
    const math = create(all);
    const n: number = math.add(1, 2);
    expect(n).toBe(3);
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
