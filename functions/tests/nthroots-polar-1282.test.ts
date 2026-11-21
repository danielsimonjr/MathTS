/**
 * #1282: `nthRoots` returned a root with an object as its real part.
 *
 * The factory built each off-axis root with `new Complex({ r, phi })`. The core `Complex`
 * constructor takes `(re, im)`, so the polar object became `re`. The fix builds the root
 * with `Complex.fromPolar(r, phi)`. The oracle is mathjs 15.2.0 in the same process, compared
 * bit for bit (no tolerance). A literal from one engine does not hold on the other: the `sin`
 * and `cos` of V8 and of JavaScriptCore differ in the last bit for some roots.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { Complex } from '@danielsimonjr/mathts-core';
import { nthRoots, complex } from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const roots = nthRoots as unknown as Fn;
const cx = complex as unknown as Fn;

/** The roots that mathjs gives for the same input, as [re, im] pairs. */
function mathjsRoots(x: number | [number, number], n: number): Array<[number, number]> {
  const input = typeof x === 'number' ? x : mathjs.complex(x[0], x[1]);
  return (mathjs.nthRoots(input as never, n) as unknown as mathjs.Complex[]).map((r) => [
    r.re,
    r.im,
  ]);
}

function expectRoots(got: unknown, want: Array<[number, number]>): void {
  expect(Array.isArray(got)).toBe(true);
  const list = got as Complex[];
  expect(list).toHaveLength(want.length);
  list.forEach((root, i) => {
    expect(root).toBeInstanceOf(Complex);
    expect(typeof root.re).toBe('number');
    expect(typeof root.im).toBe('number');
    expect(Object.is(root.re, want[i][0]) && Object.is(root.im, want[i][1])).toBe(true);
  });
}

describe('nthRoots builds each root from polar form (#1282)', () => {
  it('cube roots of 8i have number parts', () => {
    expectRoots(roots(cx(0, 8), 3), mathjsRoots([0, 8], 3));
  });

  it('cube roots of -8 (real input) have number parts', () => {
    expectRoots(roots(-8, 3), mathjsRoots(-8, 3));
  });

  it('cube roots of 2 (real input) have number parts', () => {
    expectRoots(roots(2, 3), mathjsRoots(2, 3));
  });

  it('fifth roots of 1 + i have number parts', () => {
    expectRoots(roots(cx(1, 1), 5), mathjsRoots([1, 1], 5));
  });

  it('cube roots of 1 have number parts', () => {
    expectRoots(roots(1, 3), mathjsRoots(1, 3));
  });
});
