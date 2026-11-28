/**
 * #1259 through the compat instance: `hypot`, `abs` of a Complex, `norm` and `distance` follow
 * the IEEE 754 rule. An infinite argument gives +Infinity, also with a NaN; else a NaN gives NaN.
 * The oracle is `Math.hypot`. mathjs 15.2.0 gives NaN for these rows; MathTS deviates on purpose.
 * `distance` matches mathjs 15.3.0 euclidean accumulation (#1792), including `NaN` when a
 * coordinate is `NaN` even if another is infinite.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const m = create(all) as unknown as Record<
  'hypot' | 'abs' | 'complex' | 'norm' | 'distance' | 'evaluate' | 'bignumber',
  Fn
>;

const rows: number[][] = [
  [Infinity, NaN],
  [NaN, -Infinity],
  [Infinity, Infinity],
  [-Infinity, NaN, 1],
  [NaN, 3],
  [3, 4],
];

const num = (v: unknown): number => Number(v);

describe('compat Euclidean magnitudes follow the IEEE rule (#1259)', () => {
  it.each(rows)('hypot, norm and evaluate of (%s, ...)', (...args) => {
    const want = Math.hypot(...args);
    expect(m.hypot(...args)).toBe(want);
    expect(m.hypot(args)).toBe(want);
    expect(num(m.hypot(...args.map((x) => m.bignumber(x))))).toBe(want);
    expect(m.norm(args)).toBe(want);
    expect(m.evaluate(`hypot(${args.map(String).join(', ')})`)).toBe(want);
  });

  it('abs of a Complex and distance', () => {
    expect(m.abs(m.complex(Infinity, NaN))).toBe(Infinity);
    expect(m.abs(m.complex(NaN, 3))).toBeNaN();
    expect(m.distance([0, 0], [Infinity, Infinity])).toBe(Infinity);
    expect(m.distance([0, 0], [Infinity, NaN])).toBeNaN();
  });
});
