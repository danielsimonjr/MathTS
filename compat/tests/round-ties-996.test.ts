/**
 * #996 through the compat instance: `round` rounds a tie away from zero, as mathjs 15.2.0 does.
 * The four repros of the issue, plus the live mathjs result for each.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as F from '@danielsimonjr/mathts-functions';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const m = create(all) as unknown as { round: Fn };
const mj = mathjs as unknown as { round: Fn };

describe('compat round (#996)', () => {
  it('m.round(-2.5) is -3', () => {
    expect(m.round(-2.5)).toBe(-3);
    expect(m.round(-2.5)).toBe(mj.round(-2.5));
  });

  it('m.round([-2.5, 1.5]) is [-3, 2]', () => {
    expect(m.round([-2.5, 1.5])).toEqual([-3, 2]);
    expect(m.round([-2.5, 1.5])).toEqual(mj.round([-2.5, 1.5]));
  });

  it('m.round(1.005, 2) is 1.01', () => {
    expect(m.round(1.005, 2)).toBe(1.01);
    expect(m.round(1.005, 2)).toBe(mj.round(1.005, 2));
  });

  it('the functions round(-2.5) is -3', () => {
    expect((F.round as unknown as Fn)(-2.5)).toBe(-3);
  });
});
