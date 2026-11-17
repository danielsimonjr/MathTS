import { describe, it, expect } from 'vitest';
import { nintegrate } from '../src/typed/numeric.js';
import { integrate } from '../src/typed/cas.js';
import { quad } from '../src/numeric/adaptive-quad.js';
import { dblquad, tanhSinh, tplquad } from '../src/numeric/quadrature-extra.js';

describe('nintegrate on divergent or non-finite integrals (#998)', () => {
  it.each([
    ['1/x on [0,1]', (x: number) => 1 / x, 0, 1, /did not converge/],
    ['1/x^2 on [0,1]', (x: number) => 1 / (x * x), 0, 1, /did not converge/],
    ['1/x on [1,0]', (x: number) => 1 / x, 1, 0, /did not converge/],
    ['1/x on [-1,1]', (x: number) => 1 / x, -1, 1, /not finite/],
    ['NaN integrand', () => NaN, 0, 1, /not finite/],
    ['exp on [0,710]', Math.exp, 0, 710, /not finite/],
    ['x^-0.9', (x: number) => x ** -0.9, 0, 1, /did not converge/],
  ])('throws RangeError for %s', (_n, f, a, b, re) => {
    expect(() => nintegrate(f, a, b)).toThrow(RangeError);
    expect(() => nintegrate(f, a, b)).toThrow(re);
  });

  it('throws when a caller-limited maxDepth leaves unresolved error', () => {
    expect(() => nintegrate(Math.sqrt, 0, 1, { maxDepth: 5 })).toThrow(RangeError);
  });

  it('integrate(fn, a, b) throws on 1/x', () => {
    expect(() => integrate((x: number) => 1 / x, 0, 1)).toThrow(RangeError);
  });

  it('keeps convergent integrals', () => {
    expect(nintegrate((x) => x ** -0.6, 0, 1)).toBeCloseTo(2.5, 6);
    expect(nintegrate((x) => 1 / Math.sqrt(x), 0, 1)).toBeCloseTo(2, 6);
    expect(nintegrate((x) => (x === 0 ? 0 : 1 / Math.sqrt(x)), 0, 1)).toBeCloseTo(2, 6);
    expect(nintegrate((x) => (x >= 1 ? 0 : 1 / Math.sqrt(1 - x)), 0, 1)).toBeCloseTo(2, 6);
    expect(nintegrate(Math.sin, 0, 2 * Math.PI)).toBeCloseTo(0, 12);
    expect(nintegrate((x) => Math.sin(50 * x), 0, 2 * Math.PI)).toBeCloseTo(0, 12);
    expect(nintegrate((x) => 1 / Math.sqrt(x) - 2, 0, 1)).toBeCloseTo(0, 6);
    expect(nintegrate(Math.log, 0, 1)).toBeCloseTo(-1, 10);
    expect(nintegrate(Math.sqrt, 0, 1)).toBeCloseTo(2 / 3, 10);
    expect(nintegrate((x) => Math.sin(1 / x), 0.01, 1)).toBeCloseTo(0.5039818931754154, 10);
    expect(nintegrate((x) => Math.exp(-1e6 * (x - 0.5) ** 2), 0, 1)).toBeCloseTo(
      0.001772453850905523,
      12
    );
    expect(nintegrate((x) => (x > 0.3 ? 1 : 0), 0, 1)).toBeCloseTo(0.7, 12);
  });
});

describe('quad reports converged (#998)', () => {
  it('does not throw on 1/x and flags it', () => {
    const r = quad((x) => 1 / x, 0, 1);
    expect(r.converged).toBe(false);
    expect(r.value).toBeCloseTo(41.68915999972937, 8);
    expect(r.error).toBeCloseTo(1.8460866870142087, 8);
  });
  it('flags convergent cases true', () => {
    expect(quad(Math.sin, 0, Math.PI).converged).toBe(true);
    expect(quad((x) => 1 / Math.sqrt(x), 0, 1).converged).toBe(true);
  });
  it('NaN integrand', () => {
    const r = quad(() => NaN, 0, 1);
    expect(r.value).toBeNaN();
    expect(r.error).toBeNaN();
    expect(r.converged).toBe(false);
  });
  it('dblquad ANDs the inner flags', () => {
    const d = dblquad((_y, x) => 1 / x, 0, 1, 0, 1);
    expect(d.converged).toBe(false);
    expect(d.value).toBeCloseTo(41.68915999972924, 8);
    expect(dblquad((y, x) => x * y, 0, 1, 0, 1).converged).toBe(true);
  });
});

describe('tanhSinh, dblquad and tplquad converged flags (#998)', () => {
  it('tanhSinh', () => {
    expect(tanhSinh((x) => 1 / x, 0, 1).converged).toBe(false);
    expect(tanhSinh(Math.sin, 0, 1).converged).toBe(true);
    expect(tanhSinh(() => NaN, 0, 1).converged).toBe(false);
  });
  it('tplquad', () => {
    const o = { maxDepth: 12 };
    expect(tplquad((z, _y, _x) => 1 / z, 0, 1, 0, 1, 0, 1, o).converged).toBe(false);
    expect(tplquad((_z, y, _x) => 1 / y, 0, 1, 0, 1, 0, 1, o).converged).toBe(false);
    expect(tplquad((_z, _y, x) => 1 / x, 0, 1, 0, 1, 0, 1, o).converged).toBe(false);
    const t = tplquad((z, y, x) => x * y * z, 0, 1, 0, 1, 0, 1, o);
    expect(t.converged).toBe(true);
    expect(t.value).toBeCloseTo(0.125, 12);
  });
  it('dblquad inner 1/y', () => {
    expect(dblquad((y, _x) => 1 / y, 0, 1, 0, 1).converged).toBe(false);
  });
});

describe('nintegrate edges (#998)', () => {
  it('quad result keys', () => {
    expect(Object.keys(quad(Math.sin, 0, 1)).sort()).toEqual(['converged', 'error', 'value']);
  });
  it('equal limits, maxDepth 0, names and NaN limits', () => {
    expect(nintegrate((x) => 1 / x, 1, 1)).toBe(0);
    expect(nintegrate((x) => x * x, 0, 1, { maxDepth: 0 })).toBeCloseTo(1 / 3, 12);
    expect(() => integrate((x: number) => 1 / x, 0, 1)).toThrow(/^integrate: /);
    expect(() => nintegrate((x) => x, NaN, 1)).toThrow(/a limit is NaN/);
  });
  it('a larger maxDepth resolves x^-p', () => {
    expect(nintegrate((x) => x ** -0.7, 0, 1, { maxDepth: 100 })).toBeCloseTo(10 / 3, 8);
    expect(nintegrate((x) => x ** -0.9, 0, 1, { maxDepth: 400 })).toBeCloseTo(10, 8);
    expect(() => nintegrate((x) => 1 / x, 0, 1, { maxDepth: 400 })).toThrow(/did not converge/);
  });
});
