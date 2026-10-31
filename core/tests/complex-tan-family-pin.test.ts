/**
 * P6-5 pins for `Complex.tan` / `cot` / `tanh` / `coth` (one closed form, `createTanFamilyMethod`).
 *
 * The four pre-P6-5 bodies are repeated below and every grid point is compared with `Object.is`,
 * so a changed sign of zero, a swapped part, a flipped overflow branch, or a last-bit difference
 * fails. The reference runs in the same process as the shipped methods, so the result does not
 * depend on how an engine rounds `Math.cosh`/`Math.exp`, which differs between V8 and
 * JavaScriptCore.
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '../src/types/complex.js';

const OVERFLOW = 700;

type Pair = readonly [number, number];

const legacy: Record<'tan' | 'cot' | 'tanh' | 'coth', (z: Complex) => Pair> = {
  tan(z) {
    const x2 = z.re * 2;
    const y2 = z.im * 2;
    if (Math.abs(y2) > OVERFLOW) {
      return [2 * Math.sin(x2) * Math.exp(-Math.abs(y2)), Math.sign(y2)];
    }
    const d = Math.cos(x2) + Math.cosh(y2);
    return [Math.sin(x2) / d, Math.sinh(y2) / d];
  },
  cot(z) {
    const x2 = z.re * 2;
    const y2 = z.im * 2;
    if (Math.abs(y2) > OVERFLOW) {
      return [2 * Math.sin(x2) * Math.exp(-Math.abs(y2)), -Math.sign(y2)];
    }
    const d = Math.cosh(y2) - Math.cos(x2);
    return [Math.sin(x2) / d, -Math.sinh(y2) / d];
  },
  tanh(z) {
    const x2 = z.re * 2;
    const y2 = z.im * 2;
    if (Math.abs(x2) > OVERFLOW) {
      return [Math.sign(x2), 2 * Math.sin(y2) * Math.exp(-Math.abs(x2))];
    }
    const d = Math.cosh(x2) + Math.cos(y2);
    return [Math.sinh(x2) / d, Math.sin(y2) / d];
  },
  coth(z) {
    const x2 = z.re * 2;
    const y2 = z.im * 2;
    if (Math.abs(x2) > OVERFLOW) {
      return [Math.sign(x2), -2 * Math.sin(y2) * Math.exp(-Math.abs(x2))];
    }
    const d = Math.cosh(x2) - Math.cos(y2);
    return [Math.sinh(x2) / d, -Math.sin(y2) / d];
  },
};

const METHODS = ['tan', 'cot', 'tanh', 'coth'] as const;

// The doubled argument is compared with 700, so the threshold is at 350 on the real or imaginary part.
const EDGES = [
  0,
  -0,
  1e-300,
  0.25,
  -0.5,
  1,
  Math.PI / 4,
  Math.PI / 2,
  -Math.PI / 2,
  Math.PI,
  2,
  -3,
  4,
  10,
  349.9999999999999,
  350,
  350.00000000000006,
  -350,
  -350.00000000000006,
  351,
  600,
  1e3,
  -1e5,
  Number.MAX_VALUE,
  Infinity,
  -Infinity,
  NaN,
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grid(): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (const re of EDGES) {
    for (const im of EDGES) {
      pts.push([re, im]);
    }
  }
  const rand = mulberry32(0xc0ffee);
  for (let i = 0; i < 20_000; i++) {
    const scale = [1, 10, 400, 1e4][i % 4];
    const re = (rand() - 0.5) * 2 * scale;
    const im = (rand() - 0.5) * 2 * scale;
    pts.push([re, im]);
  }
  return pts;
}

describe('Complex tan family against the pre-P6-5 bodies', () => {
  const pts = grid();

  for (const m of METHODS) {
    it(`${m}: both parts are Object.is-identical on ${pts.length} points`, () => {
      let mismatches = 0;
      let first = '';
      let overflowBranch = 0;
      for (const [re, im] of pts) {
        const z = new Complex(re, im);
        const got = z[m]();
        const [wre, wim] = legacy[m](z);
        if (!Object.is(got.re, wre) || !Object.is(got.im, wim)) {
          mismatches++;
          first ||= `(${re}, ${im}): got (${got.re}, ${got.im}) want (${wre}, ${wim})`;
        }
        const arg = m === 'tan' || m === 'cot' ? im : re;
        if (Math.abs(arg * 2) > OVERFLOW) {
          overflowBranch++;
        }
      }
      expect(first).toBe('');
      expect(mismatches).toBe(0);
      // the grid has to reach the overflow branch, or the pin is vacuous
      expect(overflowBranch).toBeGreaterThan(1000);
    });
  }

  it('keeps the exact limits past the overflow threshold, with their signs of zero', () => {
    const tanBig = new Complex(0.3, 351).tan();
    expect(tanBig.im).toBe(1);
    expect(new Complex(0.3, -351).tan().im).toBe(-1);
    expect(new Complex(0.3, 351).cot().im).toBe(-1);
    expect(new Complex(0.3, -351).cot().im).toBe(1);
    expect(new Complex(351, 0.2).tanh().re).toBe(1);
    expect(new Complex(-351, 0.2).tanh().re).toBe(-1);
    expect(new Complex(351, 0).coth().re).toBe(1);
    expect(Object.is(new Complex(351, 0).coth().im, -0)).toBe(true);
    expect(Object.is(new Complex(351, 0).tanh().im, 0)).toBe(true);
    expect(Object.is(new Complex(0, 0).tan().re, 0)).toBe(true);
    expect(Object.is(new Complex(0, 0).tan().im, 0)).toBe(true);
    expect(Object.is(new Complex(0, 0).tanh().re, 0)).toBe(true);
  });

  it('matches independent reference values at ordinary points', () => {
    const z = new Complex(0.3, 0.4);
    const close = (a: number, b: number): void => expect(a).toBeCloseTo(b, 14);
    close(z.tan().re, 0.261073681841663);
    close(z.tan().im, 0.41063347084255636);
    close(z.cot().re, 1.1026034184749278);
    close(z.cot().im, -1.7342455413250824);
    close(z.tanh().re, 0.3382547432654715);
    close(z.tanh().im, 0.38113207427244294);
    close(z.coth().re, 1.3025933473515863);
    close(z.coth().im, -1.467710695249466);
  });

  it('installs the four methods on the prototype with the attributes of a class method', () => {
    const sin = Object.getOwnPropertyDescriptor(Complex.prototype, 'sin')!;
    for (const m of METHODS) {
      const d = Object.getOwnPropertyDescriptor(Complex.prototype, m)!;
      expect(typeof d.value).toBe('function');
      expect(d.writable).toBe(sin.writable);
      expect(d.enumerable).toBe(sin.enumerable);
      expect(d.configurable).toBe(sin.configurable);
      expect(d.value.name).toBe(m);
      expect(d.value.length).toBe(0);
    }
    const z = new Complex(1, 2);
    expect(Object.keys(z)).toEqual(Object.keys(new Complex(3, 4)));
    const seen: string[] = [];
    for (const key in z) seen.push(key);
    expect(seen).toEqual(Object.keys(z));
  });
});
