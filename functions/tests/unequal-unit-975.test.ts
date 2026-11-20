/**
 * #975.2: `unequal` of two Units must agree with `equal` and with the collection rows.
 * `equal(1 m, 100 cm)` is true; `unequal` of the same pair was true too, while
 * `unequal([1 m], [100 cm])` (the factory function) was `[false]`.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const unequal = math.unequal as unknown as Fn;
const equal = math.equal as unknown as Fn;
const unit = math.unit as unknown as (s: string) => unknown;

describe('#975 unequal of Units', () => {
  it('is false for one quantity in two display units (mathjs: false)', () => {
    expect(unequal(unit('1 m'), unit('100 cm'))).toBe(false);
    expect(unequal(unit('100 cm'), unit('1 m'))).toBe(false);
  });
  it('is true for two quantities, and agrees with equal', () => {
    expect(unequal(unit('1 m'), unit('2 m'))).toBe(true);
    for (const [a, b] of [
      ['1 m', '100 cm'],
      ['1 m', '2 m'],
      ['5 kg', '5000 g'],
    ] as const) {
      expect(unequal(unit(a), unit(b))).toBe(!(equal(unit(a), unit(b)) as boolean));
    }
  });
  it('agrees with the collection rows', () => {
    expect(unequal([unit('1 m')], [unit('100 cm')])).toEqual([false]);
    expect(unequal(unit('1 m'), unit('100 cm'))).toBe(false);
  });
});
