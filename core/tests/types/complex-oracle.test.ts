/**
 * PR 8 — Complex elementary methods pinned to CPython `cmath` (libm), not to
 * `Complex` itself. Reviewer spot-check:
 *   python3 -c 'import cmath; print(cmath.sin(complex(0.5, 0.25)))'
 */
import { describe, it, expect } from 'vitest';
import { Complex } from '../../src/types/complex.js';

const Z = new Complex(0.5, 0.25);

function expectPart(got: number, expected: number, label: string): void {
  if (expected === 0) {
    expect(Math.abs(got), label).toBeLessThan(1e-12);
  } else {
    expect(Math.abs(got - expected) / Math.abs(expected), label).toBeLessThan(1e-12);
  }
}

function expectComplex(c: Complex, re: number, im: number, label: string): void {
  expectPart(c.re, re, `${label}.re`);
  expectPart(c.im, im, `${label}.im`);
}

describe('Complex elementary vs cmath oracle (0.5 + 0.25i)', () => {
  it('sin', () => {
    expectComplex(Z.sin(), 0.49448578093319501, 0.22168816414957482, 'sin');
  });

  it('cos', () => {
    expectComplex(Z.cos(), 0.90515015055960679, -0.12110879604381165, 'cos');
  });

  it('tan', () => {
    expectComplex(Z.tan(), 0.50450070269856395, 0.31242069250258875, 'tan');
  });

  it('exp', () => {
    expectComplex(Z.exp(), 1.5974665191199127, 0.40790017007835982, 'exp');
  });

  it('log', () => {
    expectComplex(Z.log(), -0.58157540490284043, 0.46364760900080609, 'log');
  });

  it('sqrt', () => {
    expectComplex(Z.sqrt(), 0.72767334511267745, 0.17178037486125622, 'sqrt');
  });

  it('asin', () => {
    expectComplex(Z.asin(), 0.50160885327550075, 0.28139605624529274, 'asin');
  });

  it('acos', () => {
    expectComplex(Z.acos(), 1.069187473519396, -0.28139605624529274, 'acos');
  });

  it('atan', () => {
    expectComplex(Z.atan(), 0.4842544903299662, 0.20058661813123432, 'atan');
  });

  it('sinh', () => {
    expectComplex(Z.sinh(), 0.50489571438799496, 0.27897912835026151, 'sinh');
  });

  it('cosh', () => {
    expectComplex(Z.cosh(), 1.0925708047319176, 0.12892104172809826, 'cosh');
  });

  it('tanh', () => {
    expectComplex(Z.tanh(), 0.4854872810241353, 0.19805544995134958, 'tanh');
  });
});

describe('Complex branch-cut / domain edges (current implementation)', () => {
  it('log(0) uses ln|z| → −∞ on the real axis', () => {
    const log0 = new Complex(0, 0).log();
    expect(log0.re).toBe(-Infinity);
    expect(log0.im).toBe(0);
  });

  it('sqrt(−4) on the real axis is 2i (principal branch)', () => {
    const s = new Complex(-4, 0).sqrt();
    expect(s.re).toBe(0);
    expect(s.im).toBe(2);
  });

  // cmath.tan(complex(pi/2, 700)) == 1j, cmath.tanh(complex(500, 0.3)) == (1+0j): the closed form
  // (sin 2x + i sinh 2y) / (cos 2x + cosh 2y) overflowed to Infinity / Infinity = NaN here.
  it('tan, cot, tanh, coth keep their limits where sinh/cosh overflow', () => {
    const tan = new Complex(Math.PI / 2, 700).tan();
    expect(Math.abs(tan.re)).toBeLessThan(1e-300);
    expect(tan.im).toBe(1);
    expect(new Complex(0.3, -400).tan().im).toBe(-1);
    expect(new Complex(0.3, 400).cot().im).toBe(-1);
    expect(new Complex(0.3, -400).cot().im).toBe(1);
    const tanhPos = new Complex(500, 0.3).tanh();
    expect(tanhPos.re).toBe(1);
    expect(Math.abs(tanhPos.im)).toBeLessThan(1e-300);
    expect(new Complex(-500, 0.3).tanh().re).toBe(-1);
    expect(new Complex(500, 0.3).coth().re).toBe(1);
    expect(new Complex(-500, 0.3).coth().re).toBe(-1);
  });

  it('the overflow limit joins the closed form without a jump', () => {
    // 2*349.9 = 699.8 uses the closed form, 2*350.1 = 700.2 uses the limit; the true value moves
    // by about e^-699, far below double precision, so both sides are +1i to the last digit.
    const below = new Complex(0.3, 349.9).tan();
    const above = new Complex(0.3, 350.1).tan();
    expect(below.im).toBe(1);
    expect(above.im).toBe(1);
    expect(Math.abs(below.re - above.re)).toBeLessThan(1e-300);
  });
});
