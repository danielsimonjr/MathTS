/**
 * #1282: `nthRoots` returned a root with an object as its real part.
 *
 * The factory built each off-axis root with `new Complex({ r, phi })`. The core `Complex`
 * constructor takes `(re, im)`, so the polar object became `re`. The fix builds the root
 * with `Complex.fromPolar(r, phi)`. Every expected value below is the mathjs 15.2.0 result
 * (bit exact, so no tolerance is used).
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { nthRoots, complex } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const roots = nthRoots as unknown as Fn;
const cx = complex as unknown as Fn;

function expectRoots(got: unknown, want: Array<[number, number]>): void {
  expect(Array.isArray(got)).toBe(true);
  const list = got as Complex[];
  expect(list).toHaveLength(want.length);
  list.forEach((root, i) => {
    expect(root).toBeInstanceOf(Complex);
    expect(typeof root.re).toBe('number');
    expect(typeof root.im).toBe('number');
    expect([root.re, root.im]).toEqual(want[i]);
  });
}

describe('nthRoots builds each root from polar form (#1282)', () => {
  it('cube roots of 8i have number parts', () => {
    expectRoots(roots(cx(0, 8), 3), [
      [1.7320508075688774, 0.9999999999999999],
      [-1.7320508075688774, 0.9999999999999999],
      [0, -2],
    ]);
  });

  it('cube roots of -8 (real input) have number parts', () => {
    expectRoots(roots(-8, 3), [
      [1.0000000000000002, 1.7320508075688772],
      [-2, 0],
      [1.0000000000000002, -1.7320508075688772],
    ]);
  });

  it('cube roots of 2 (real input) have number parts', () => {
    expectRoots(roots(2, 3), [
      [1.2599210498948732, 0],
      [-0.6299605249474363, 1.0911236359717216],
      [-0.6299605249474372, -1.0911236359717211],
    ]);
  });

  it('fifth roots of 1 + i have number parts', () => {
    expectRoots(roots(cx(1, 1), 5), [
      [1.0585781527063765, 0.16766230825618095],
      [0.167662308256181, 1.0585781527063765],
      [-0.9549571475717944, 0.4865749698644362],
      [-0.7578582832551992, -0.757858283255199],
      [0.486574969864436, -0.9549571475717946],
    ]);
  });

  it('cube roots of 1 have number parts', () => {
    expectRoots(roots(1, 3), [
      [1, 0],
      [-0.4999999999999998, 0.8660254037844387],
      [-0.5000000000000004, -0.8660254037844385],
    ]);
  });
});
