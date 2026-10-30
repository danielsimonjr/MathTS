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

  it('tan with huge |Im| underflows the real cosine → NaN imaginary part', () => {
    // cos(π)+cosh(700) overflows; denominator is non-finite → 0/Inf style NaN.
    const t = new Complex(Math.PI / 2, 700).tan();
    expect(t.re).toBe(0);
    expect(Number.isNaN(t.im)).toBe(true);
  });
});
