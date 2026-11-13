/**
 * Dogfood issue #955 — `unit(v, u)` and `evaluate('v u')` store one value.
 *
 * Decision (lead, revised): both mathts forms keep the exact route. A number reading times a
 * unit is rounded once from the exact product, so both forms store the exact SI value and
 * print the reading as written. mathjs 15 prints the float product on both paths
 * (`0.7499999999999999 inch`). That difference is a documented deviation (compat README).
 */

import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

type Unitish = { value: number | null; toString(): string };
type Api = {
  unit: (v: number, u: string) => Unitish;
  evaluate: (expr: string) => Unitish;
};

const mt = create(all) as unknown as Api;

describe('dogfood #955 unit and evaluate agree, and match the exact value', () => {
  it.each([
    [0.75, 'inch', 0.01905, '0.75 inch'],
    [1, 'ft', 0.3048, '1 ft'],
    [2.54, 'cm', 0.0254, '2.54 cm'],
  ])('%s %s: both paths store the exact SI value %s and print %s', (v, u, si, printed) => {
    const viaUnit = mt.unit(v, u);
    const viaEval = mt.evaluate(`${v} ${u}`);
    expect(viaUnit.value).toBe(si);
    expect(viaEval.value).toBe(si);
    expect(viaUnit.toString()).toBe(printed);
    expect(viaEval.toString()).toBe(printed);
  });

  it('a compound unit (60 mile/hour): both paths agree with each other and the exact value', () => {
    // 60 mile/hour = 60 × 1609.344 m / 3600 s = 26.8224 m/s, the exact value.
    const viaUnit = mt.unit(60, 'mile/hour');
    const viaEval = mt.evaluate('60 mile/hour');
    expect(viaUnit.value).toBe(26.8224);
    expect(viaEval.value).toBe(viaUnit.value);
    expect(viaEval.toString()).toBe(viaUnit.toString());
  });
});
