import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import * as compat from '../src/index.js';
import { MATHJS_UNIT_CONSTANTS } from '../src/parity-names.generated.js';

describe('named physical constants', () => {
  const actual = compat as unknown as Record<string, { toNumeric(unit: string): number }>;
  const expected = oracle as unknown as typeof actual;

  it.each(MATHJS_UNIT_CONSTANTS)('exports the MathJS value of %s', (name, _, unit) => {
    expect(actual[name].toNumeric(unit) / expected[name].toNumeric(unit)).toBeCloseTo(1, 12);
    expect(compat.isUnit(actual[name])).toBe(true);
  });

  it('exports the default scalar constants and numeric type helpers', () => {
    expect(compat.fineStructure).toBe(Reflect.get(oracle, 'fineStructure'));
    expect(compat.isBigNumber(compat.bignumber('2'))).toBe(true);
    expect(compat.help('sin').toJSON()).toMatchObject({ name: 'sin' });
    expect(compat.typed('inc', { number: (x: number) => x + 1 })(2)).toBe(3);
  });
});
